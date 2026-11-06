#[cfg(target_os = "windows")]
mod windows_picker {
    use std::ffi::c_void;
    use std::sync::atomic::{AtomicBool, AtomicPtr, AtomicU8, Ordering};
    use std::sync::{Mutex, OnceLock};
    use windows::core::w;
    use windows::Win32::Foundation::{COLORREF, HINSTANCE, HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::Graphics::Dwm::DwmFlush;
    use windows::Win32::Graphics::Gdi::{
        CreateSolidBrush, GetDC, GetPixel, ReleaseDC, UpdateWindow, CLR_INVALID,
    };
    use windows::Win32::UI::Input::KeyboardAndMouse::VK_ESCAPE;
    use windows::Win32::UI::WindowsAndMessaging::{
        CallNextHookEx, CreateCursor, CreateWindowExW, DefWindowProcW, DestroyWindow,
        DispatchMessageW, GetMessageW, GetSystemMetrics, PostQuitMessage, RegisterClassW,
        SetCursor, SetLayeredWindowAttributes, SetWindowsHookExW, ShowWindow, TranslateMessage,
        UnhookWindowsHookEx, HCURSOR, HC_ACTION, KBDLLHOOKSTRUCT, LWA_ALPHA, MSG,
        MSLLHOOKSTRUCT, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN,
        SM_YVIRTUALSCREEN, SW_HIDE, SW_SHOW, WH_KEYBOARD_LL, WH_MOUSE_LL, WM_KEYDOWN,
        WM_LBUTTONDOWN, WM_LBUTTONUP, WM_RBUTTONDOWN, WM_RBUTTONUP, WM_SETCURSOR, WM_SYSKEYDOWN, WNDCLASSW, WS_EX_LAYERED, WS_EX_TOOLWINDOW, WS_EX_TOPMOST, WS_POPUP,
    };

    static PICKER_ACTIVE: AtomicBool = AtomicBool::new(false);
    static PICKER_STATE: AtomicU8 = AtomicU8::new(0);
    static OVERLAY_CLASS_REGISTERED: AtomicBool = AtomicBool::new(false);
    static OVERLAY_CURSOR: AtomicPtr<c_void> = AtomicPtr::new(std::ptr::null_mut());
    static OVERLAY_WINDOW: AtomicPtr<c_void> = AtomicPtr::new(std::ptr::null_mut());
    static PICKED_COLOR: OnceLock<Mutex<Option<String>>> = OnceLock::new();

    fn color_slot() -> &'static Mutex<Option<String>> {
        PICKED_COLOR.get_or_init(|| Mutex::new(None))
    }

    fn create_eyedropper_cursor() -> Result<HCURSOR, String> {
        const WIDTH: usize = 32;
        const HEIGHT: usize = 32;
        const ROW_BYTES: usize = WIDTH / 8;
        // "Dropper" silhouette — CC 4.0, Icon Works: http://icon-works.com/
        const OUTER: [(i32, i32); 28] = [
            (31, 5),
            (30, 2),
            (28, 1),
            (26, 0),
            (24, 0),
            (22, 1),
            (20, 3),
            (19, 4),
            (18, 3),
            (17, 2),
            (15, 3),
            (14, 4),
            (13, 6),
            (14, 8),
            (16, 10),
            (4, 22),
            (2, 25),
            (1, 27),
            (0, 28),
            (0, 29),
            (2, 31),
            (4, 31),
            (7, 29),
            (21, 15),
            (23, 17),
            (25, 17),
            (27, 15),
            (27, 13),
        ];
        const INNER: [(i32, i32); 7] = [
            (7, 27),
            (4, 29),
            (2, 29),
            (4, 25),
            (5, 23),
            (17, 11),
            (20, 14),
        ];
        const CUTOUT: [(i32, i32); 10] = [
            (28, 7),
            (24, 11),
            (26, 13),
            (24, 15),
            (16, 7),
            (18, 5),
            (20, 7),
            (23, 4),
            (26, 3),
            (29, 5),
        ];
        let mut and_mask = [0xff_u8; ROW_BYTES * HEIGHT];
        let mut xor_mask = [0_u8; ROW_BYTES * HEIGHT];
        let contains = |polygon: &[(i32, i32)], x: i32, y: i32| {
            let mut inside = false;
            let mut previous = polygon.len() - 1;
            for current in 0..polygon.len() {
                let (x1, y1) = polygon[current];
                let (x2, y2) = polygon[previous];
                if (y1 > y) != (y2 > y) && x < (x2 - x1) * (y - y1) / (y2 - y1) + x1 {
                    inside = !inside;
                }
                previous = current;
            }
            inside
        };
        for y in 0..HEIGHT {
            for x in 0..WIDTH {
                if !contains(&OUTER, x as i32, y as i32) {
                    continue;
                }
                let byte_index = y * ROW_BYTES + x / 8;
                let bit = 0x80 >> (x % 8);
                and_mask[byte_index] &= !bit;
                if contains(&INNER, x as i32, y as i32) || contains(&CUTOUT, x as i32, y as i32) {
                    xor_mask[byte_index] |= bit;
                }
            }
        }
        unsafe {
            CreateCursor(
                Some(HINSTANCE::default()),
                3,
                29,
                WIDTH as i32,
                HEIGHT as i32,
                and_mask.as_ptr().cast(),
                xor_mask.as_ptr().cast(),
            )
            .map_err(|error| error.to_string())
        }
    }

    unsafe extern "system" fn overlay_window_proc(
        hwnd: windows::Win32::Foundation::HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if (message == WM_KEYDOWN || message == WM_SYSKEYDOWN)
            && wparam.0 == VK_ESCAPE.0 as usize
            && PICKER_STATE.load(Ordering::SeqCst) == 0
        {
            PICKER_STATE.store(2, Ordering::SeqCst);
            PostQuitMessage(0);
            return LRESULT(0);
        }
        if message == WM_SETCURSOR {
            let cursor = OVERLAY_CURSOR.load(Ordering::SeqCst);
            if !cursor.is_null() {
                SetCursor(Some(HCURSOR(cursor)));
                return LRESULT(1);
            }
        }
        DefWindowProcW(hwnd, message, wparam, lparam)
    }

    struct PickerOverlay(windows::Win32::Foundation::HWND);

    impl PickerOverlay {
        fn create() -> Result<Self, String> {
            unsafe {
                let overlay_color = COLORREF(0x00000000);
                if !OVERLAY_CLASS_REGISTERED.swap(true, Ordering::SeqCst) {
                    let cursor = create_eyedropper_cursor()?;
                    OVERLAY_CURSOR.store(cursor.0, Ordering::SeqCst);
                    let class = WNDCLASSW {
                        lpfnWndProc: Some(overlay_window_proc),
                        hInstance: HINSTANCE::default(),
                        hCursor: cursor,
                        hbrBackground: CreateSolidBrush(overlay_color),
                        lpszClassName: w!("PaideiaScreenColorPickerOverlay"),
                        ..Default::default()
                    };
                    if RegisterClassW(&class) == 0 {
                        OVERLAY_CLASS_REGISTERED.store(false, Ordering::SeqCst);
                        return Err(
                            "Unable to register the screen color picker overlay".to_string()
                        );
                    }
                }
                let window = CreateWindowExW(
                    WS_EX_TOPMOST | WS_EX_TOOLWINDOW | WS_EX_LAYERED,
                    w!("PaideiaScreenColorPickerOverlay"),
                    w!(""),
                    WS_POPUP,
                    GetSystemMetrics(SM_XVIRTUALSCREEN),
                    GetSystemMetrics(SM_YVIRTUALSCREEN),
                    GetSystemMetrics(SM_CXVIRTUALSCREEN),
                    GetSystemMetrics(SM_CYVIRTUALSCREEN),
                    None,
                    None,
                    Some(HINSTANCE::default()),
                    None,
                )
                .map_err(|error| error.to_string())?;
                SetLayeredWindowAttributes(window, overlay_color, 1, LWA_ALPHA)
                    .map_err(|error| error.to_string())?;
                let _ = ShowWindow(window, SW_SHOW);
                let _ = UpdateWindow(window);
                OVERLAY_WINDOW.store(window.0, Ordering::SeqCst);
                Ok(Self(window))
            }
        }
    }

    impl Drop for PickerOverlay {
        fn drop(&mut self) {
            unsafe {
                OVERLAY_WINDOW.store(std::ptr::null_mut(), Ordering::SeqCst);
                let _ = DestroyWindow(self.0);
            }
        }
    }

    fn read_screen_pixel(x: i32, y: i32) -> Option<String> {
        unsafe {
            let screen_dc = GetDC(None);
            if screen_dc.is_invalid() {
                return None;
            }
            let color = GetPixel(screen_dc, x, y);
            ReleaseDC(None, screen_dc);
            if color.0 == CLR_INVALID {
                return None;
            }
            Some(colorref_to_hex(color))
        }
    }

    fn colorref_to_hex(color: COLORREF) -> String {
        let value = color.0;
        let red = value & 0xff;
        let green = (value >> 8) & 0xff;
        let blue = (value >> 16) & 0xff;
        format!("#{red:02X}{green:02X}{blue:02X}")
    }

    unsafe extern "system" fn mouse_hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code == HC_ACTION as i32 {
            let message = wparam.0 as u32;
            if message == WM_LBUTTONDOWN && PICKER_STATE.load(Ordering::SeqCst) == 0 {
                let mouse = &*(lparam.0 as *const MSLLHOOKSTRUCT);
                let overlay = OVERLAY_WINDOW.load(Ordering::SeqCst);
                if !overlay.is_null() {
                    let _ = ShowWindow(HWND(overlay), SW_HIDE);
                    let _ = DwmFlush();
                }
                *color_slot().lock().expect("screen color slot poisoned") =
                    read_screen_pixel(mouse.pt.x, mouse.pt.y);
                PICKER_STATE.store(1, Ordering::SeqCst);
                return LRESULT(1);
            } else if message == WM_LBUTTONUP && PICKER_STATE.load(Ordering::SeqCst) == 1 {
                PostQuitMessage(0);
                return LRESULT(1);
            } else if message == WM_RBUTTONDOWN && PICKER_STATE.load(Ordering::SeqCst) == 0 {
                PICKER_STATE.store(2, Ordering::SeqCst);
                return LRESULT(1);
            } else if message == WM_RBUTTONUP && PICKER_STATE.load(Ordering::SeqCst) == 2 {
                PostQuitMessage(0);
                return LRESULT(1);
            }
        }
        CallNextHookEx(None, code, wparam, lparam)
    }

    unsafe extern "system" fn keyboard_hook(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
        if code == HC_ACTION as i32 {
            let message = wparam.0 as u32;
            let keyboard = &*(lparam.0 as *const KBDLLHOOKSTRUCT);
            if keyboard.vkCode == VK_ESCAPE.0 as u32 {
                if message == WM_KEYDOWN || message == WM_SYSKEYDOWN {
                    PICKER_STATE.store(2, Ordering::SeqCst);
                    PostQuitMessage(0);
                    return LRESULT(1);
                }
            }
        }
        CallNextHookEx(None, code, wparam, lparam)
    }

    struct PickerActiveGuard;

    impl Drop for PickerActiveGuard {
        fn drop(&mut self) {
            PICKER_ACTIVE.store(false, Ordering::SeqCst);
        }
    }

    pub fn pick() -> Result<Option<String>, String> {
        if PICKER_ACTIVE.swap(true, Ordering::SeqCst) {
            return Err("A screen color picker is already active".to_string());
        }
        let _active_guard = PickerActiveGuard;
        PICKER_STATE.store(0, Ordering::SeqCst);
        *color_slot().lock().map_err(|error| error.to_string())? = None;

        unsafe {
            let _overlay = PickerOverlay::create()?;
            let mouse_hook = SetWindowsHookExW(WH_MOUSE_LL, Some(mouse_hook), None, 0)
                .map_err(|error| error.to_string())?;
            let keyboard_hook =
                match SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_hook), None, 0) {
                    Ok(hook) => hook,
                    Err(error) => {
                        let _ = UnhookWindowsHookEx(mouse_hook);
                        return Err(error.to_string());
                    }
                };

            let mut message = MSG::default();
            while GetMessageW(&mut message, None, 0, 0).as_bool() {
                let _ = TranslateMessage(&message);
                DispatchMessageW(&message);
            }

            let mouse_unhook = UnhookWindowsHookEx(mouse_hook);
            let keyboard_unhook = UnhookWindowsHookEx(keyboard_hook);
            mouse_unhook.map_err(|error| error.to_string())?;
            keyboard_unhook.map_err(|error| error.to_string())?;
        }

        if PICKER_STATE.load(Ordering::SeqCst) == 2 {
            return Ok(None);
        }
        color_slot()
            .lock()
            .map(|color| color.clone())
            .map_err(|error| error.to_string())
    }
}

#[cfg(target_os = "windows")]
#[tauri::command]
pub async fn pick_screen_color(window: tauri::WebviewWindow) -> Result<Option<String>, String> {
    let result = tauri::async_runtime::spawn_blocking(windows_picker::pick)
        .await
        .map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    result
}

#[cfg(not(target_os = "windows"))]
#[tauri::command]
pub async fn pick_screen_color(_window: tauri::WebviewWindow) -> Result<Option<String>, String> {
    Err("Native screen color picking is currently available on Windows only".to_string())
}
