import type {
  CSSProperties,
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  RefObject
} from "react";
import { ACTIVITY_LIBRARY_SECTIONS } from "../../app/libraryConfig";

type LibraryActivityType = (typeof ACTIVITY_LIBRARY_SECTIONS)[number]["items"][number];

type ActivityLibraryDrawerProps = {
  drawerRef: RefObject<HTMLElement>;
  drawerTop: number;
  getLabel: (type: LibraryActivityType) => string;
  getSectionLabel: (title: string, titleKey?: string) => string;
  onCreate: (type: LibraryActivityType) => void;
  onStartDrag: (
    event: ReactPointerEvent<HTMLElement>,
    type: LibraryActivityType,
    label: string
  ) => void;
  suppressNextCreateClickRef: MutableRefObject<boolean>;
};

export function ActivityLibraryDrawer({
  drawerRef,
  drawerTop,
  getLabel,
  getSectionLabel,
  onCreate,
  onStartDrag,
  suppressNextCreateClickRef
}: ActivityLibraryDrawerProps) {
  return (
    <aside
      className="library-drawer"
      ref={drawerRef}
      style={{ "--library-drawer-top": `${drawerTop}px` } as CSSProperties}
    >
      <div className="library-header" />
      <div className="library-list">
        {ACTIVITY_LIBRARY_SECTIONS.map((section) => (
          <section className="library-section" key={section.title}>
            <h3 className="library-section-title">{getSectionLabel(section.title, section.titleKey)}</h3>
            <div className="library-section-items">
              {section.items.map((type) => {
                const label = getLabel(type);
                return (
                  <div
                    className="library-item"
                    key={type}
                    onClick={(event) => {
                      if (suppressNextCreateClickRef.current) {
                        suppressNextCreateClickRef.current = false;
                        event.preventDefault();
                        event.stopPropagation();
                        return;
                      }
                      onCreate(type);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onCreate(type);
                      }
                    }}
                    onPointerDown={(event) => onStartDrag(event, type, label)}
                    role="button"
                    tabIndex={0}
                  >
                    <strong>{label}</strong>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}
