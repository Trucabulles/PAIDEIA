import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const appCss = fs.readFileSync('src/styles.css', 'utf8');
const navigationCss = fs
  .readFileSync('src/components/activities/LessonNavigationActivity/LessonNavigationActivity.module.css', 'utf8')
  .replaceAll(':global(.navigation-button-label)', '.navigation-button-label');
const source = fs.readFileSync('src-tauri/src/commands.rs', 'utf8');
const start = source.indexOf('    :root {{ --blue:');
assert.ok(start >= 0);
const scormCss = source.slice(start, source.indexOf('  </style>', start)).replaceAll('{{', '{').replaceAll('}}', '}');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const viewportWidth of [1280, 375]) {
    const page = await browser.newPage({ viewport: { width: viewportWidth, height: 600 } });
    let baseline;
    for (const surface of ['editor', 'preview', 'scorm']) {
      const css = surface === 'scorm' ? scormCss : appCss;
      const buttonClass = surface === 'scorm' ? 'continue' : 'continue-preview-button';
      for (const label of ['Continuer', 'Sortir de la leçon']) {
        for (const inherited of ['normal 16px/normal Arial', 'italic 36px/3 Georgia']) {
          await page.setContent(`<style>${css}</style><div class="continue-block" style="font:${inherited};letter-spacing:5px;text-transform:uppercase;--lesson-custom-font:Georgia"><button class="${buttonClass}"><span>${label}</span></button></div>`);
          const actual = await page.locator('button').evaluate(button => {
            const style = getComputedStyle(button);
            const rect = button.getBoundingClientRect();
            return { font: style.fontFamily, size: style.fontSize, weight: style.fontWeight, lineHeight: style.lineHeight, height: rect.height, width: rect.width, letterSpacing: style.letterSpacing, transform: style.textTransform };
          });
          assert.equal(actual.size, '16px');
          assert.equal(actual.lineHeight, '19.2px');
          assert.equal(actual.weight, '700');
          assert.ok(actual.font.includes('Segoe UI'));
          assert.equal(actual.letterSpacing, 'normal');
          assert.equal(actual.transform, 'none');
          assert.ok(Math.abs(actual.height - 47.2) < 0.05);
          baseline ??= {};
          baseline[label] ??= actual;
          assert.ok(Math.abs(actual.width - baseline[label].width) < 0.05, `${surface}: width mismatch`);
          assert.equal(actual.height, baseline[label].height);
        }
      }
      if (surface === 'editor') continue;
      const wrapperClass = surface === 'scorm'
        ? 'block continue-block course-exit-block'
        : 'export-button-row preview-mode-test-row';
      const surfaceCss = surface === 'scorm'
        ? css
        : `${css}\n${navigationCss}`;
      const buttonOnlyClass = surface === 'scorm' ? buttonClass : `${buttonClass} button`;
      const previewWrapperClass = surface === 'scorm' ? wrapperClass : `${wrapperClass} row course-exit button-only`;
      const buttonOnlyAttributes = surface === 'scorm'
        ? `class="${previewWrapperClass}"`
        : `class="${previewWrapperClass}" data-navigation-activity="course-exit"`;
      await page.setContent(`<style>${surfaceCss}</style><div class="${surface === 'preview' ? 'preview-mode preview-mode-test-host' : 'preview-mode-test-host'}" style="width:100%"><div ${buttonOnlyAttributes}><button class="${buttonOnlyClass}"><span>Sortir de la leçon</span></button></div></div>`);
      const alignment = await page.locator('button').evaluate(button => {
        const host = button.closest('.preview-mode-test-host')?.getBoundingClientRect();
        const rect = button.getBoundingClientRect();
        return host ? Math.abs((rect.left + rect.width / 2) - (host.left + host.width / 2)) : Number.POSITIVE_INFINITY;
      });
      assert.ok(alignment < 0.05, `${surface}: course-exit button-only is not centered (${alignment}px)`);

      const composedWrapperClass = surface === 'scorm'
        ? 'block continue-block course-exit-block course-exit-has-text course-exit-text-left-button-right'
        : 'export-button-row row course-exit text-left-button-right';
      const composedButtonClass = surface === 'scorm' ? buttonClass : `${buttonClass} button`;
      const contentClass = surface === 'scorm' ? 'course-exit-copy rich-content' : 'content';
      const labelClass = surface === 'scorm' ? 'continue-label' : 'navigation-button-label';
      await page.setContent(`<style>${surfaceCss}</style><div class="${surface === 'preview' ? 'preview-mode' : ''}" style="width:100%"><div class="${composedWrapperClass}" data-course-exit-layout="text-left-button-right"><div class="${contentClass}"><p>Vous avez maintenant terminé cette leçon, n'hésitez pas à y revenir autant de fois que vous le jugerez nécessaire !</p></div><button class="${composedButtonClass}"><span class="${labelClass}">Sortir de la leçon</span></button></div></div>`);
      const composed = await page.locator('button').evaluate(button => {
        const rect = button.getBoundingClientRect();
        const label = button.querySelector('span');
        return {
          width: rect.width,
          labelFits: Boolean(label && label.scrollWidth <= label.clientWidth + 0.5)
        };
      });
      assert.ok(Math.abs(composed.width - baseline['Sortir de la leçon'].width) < 0.05, `${surface}: text composition shrinks the course-exit button`);
      assert.ok(composed.labelFits, `${surface}: text composition clips the course-exit label`);

      const longLabel = 'Sortir de la leçon et revenir immédiatement à la plateforme de formation principale';
      await page.locator('button span').evaluate((label, value) => { label.textContent = value; }, longLabel);
      const constrained = await page.locator('button').evaluate(button => {
        const row = button.parentElement?.getBoundingClientRect();
        const rect = button.getBoundingClientRect();
        const label = button.querySelector('span');
        const labelStyle = label ? getComputedStyle(label) : null;
        return {
          buttonWidth: rect.width,
          buttonHeight: rect.height,
          rowWidth: row?.width ?? 0,
          labelFits: Boolean(label && label.scrollWidth <= label.clientWidth + 0.5 && label.scrollHeight <= label.clientHeight + 0.5),
          labelHeight: label?.getBoundingClientRect().height ?? 0,
          lineHeight: Number.parseFloat(labelStyle?.lineHeight ?? '0'),
          textOverflow: labelStyle?.textOverflow ?? '',
          whiteSpace: labelStyle?.whiteSpace ?? ''
        };
      });
      const expectedMaximum = viewportWidth <= 820 ? constrained.rowWidth - 50 : constrained.rowWidth * 0.45;
      assert.ok(constrained.buttonWidth <= expectedMaximum + 0.05, `${surface}: long course-exit label exceeds its composition cap`);
      assert.ok(constrained.labelFits, `${surface}: long course-exit label is clipped`);
      assert.ok(constrained.labelHeight > constrained.lineHeight + 0.5, `${surface}: long course-exit label does not wrap`);
      assert.ok(constrained.buttonHeight > 47.2, `${surface}: wrapped course-exit button keeps its single-line height`);
      assert.equal(constrained.textOverflow, 'clip', `${surface}: long course-exit label is truncated`);
      assert.equal(constrained.whiteSpace, 'normal', `${surface}: long course-exit label cannot wrap`);
    }
    console.log(`OK ${viewportWidth}px: navigation typography, width and height independent of lesson styles across editor/preview/SCORM CSS`);
    await page.close();
  }
} finally {
  await browser.close();
}
