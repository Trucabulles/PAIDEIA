import assert from 'node:assert/strict';
import fs from 'node:fs';
import { Window } from 'happy-dom';
const rust = fs.readFileSync('src-tauri/src/commands.rs', 'utf8');
const start = rust.indexOf('var root=document.currentScript.previousElementSibling,data,labels=__PAIDEIA_COMPLETE_LABELS__;');
const end = rust.indexOf('</script>', start);
const markupStart = rust.lastIndexOf('r#"<article class="block complete-block"', start) + 3;
const fr = JSON.parse(fs.readFileSync('src/locales/fr.json', 'utf8'));
const labels = Object.fromEntries(Object.entries(fr).filter(([key]) => key.startsWith('complete.')).map(([key, value]) => [key.slice(9), value]));
labels.yourAnswer = fr['quiz.yourAnswer'];
labels.noAnswer = fr['quiz.noAnswer'];
labels.restart = fr['common.restart'];
labels.continue = fr['common.continue'];
const runtime = rust.slice(start, end).replaceAll('{{', '{').replaceAll('}}', '}')
  .replace('__PAIDEIA_COMPLETE_LABELS__', JSON.stringify(labels))
  .replace('document.currentScript.previousElementSibling', 'document.querySelector(".complete-block")');
for (const kind of ["list", "text"]) {
for (const passed of [false, true]) {
for (const reveal of [false, true]) {
  for (const maxAttempts of [0, 1, 2]) {
    const window = new Window({ settings: { enableJavaScriptEvaluation: true, suppressInsecureJavaScriptEnvironmentWarning: true } });
    window.HTMLCanvasElement.prototype.getContext = () => ({ measureText: text => ({ width: text.length * 8 }) });
    const data = { revealAnswersOnFinalReview: reveal, maxAttempts, successThreshold: 80,
      blanks: [{ id: 'answer', answer: 'attendue', variants: kind === 'list' ? ['fausse'] : [] }],
      documentHtml: '<p><span data-paideia-complete-id="answer" data-paideia-complete-kind="'+kind+'">attendue</span></p>',
      cover: { enabled: false }, ending: { successHtml: '<p>Réussite</p>', failureHtml: '<p>Échec</p>' } };
    const payload = JSON.stringify(data).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
    const replacements = { payload, orientation: 'landscape', tracking_attrs: '', cover_class: 'complete-folio', cover_hidden: ' hidden', cover_background: '#fff', cover_title: '', cover_body: '' };
    const markup = rust.slice(markupStart, start).replaceAll('{{', '{').replaceAll('}}', '}')
      .replace(/\{([a-z_]+)\}/g, (_, key) => replacements[key] ?? '').split('<script>')[0];
    window.document.body.innerHTML = markup;
    window.eval("(function(){" + runtime);
    const root = window.document.querySelector('.complete-block');
    const click = selector => root.querySelector(selector).click();
    const corrections = () => root.querySelectorAll('button.complete-response-eye').length;
    let continuations = 0;
    window.document.addEventListener('click', event => { if (event.target.closest('[data-paideia-action="continue"]')) continuations++; });
    for (let attempt = 1; attempt <= (maxAttempts || 1); attempt++) {
      const field = root.querySelector('select,input');
      field.value = passed ? 'attendue' : 'fausse';
      field.dispatchEvent(new window.Event(kind === 'list' ? 'change' : 'input'));
      click('[data-complete-primary]');
      click('[data-complete-result-next]');
      const revealed = reveal && maxAttempts > 0 && (passed || attempt === maxAttempts);
      assert.equal(root.querySelector('select,input').value, revealed || passed ? 'attendue' : 'fausse', 'review must show the solution only when revealed');
      assert.equal(root.querySelectorAll('.complete-response-correct').length, Number(passed), 'correct learner answers have a green tick');
      if (revealed && !passed) {
        const eye = root.querySelector('button.complete-response-eye');
        assert.equal(eye.getAttribute('aria-label'), labels.yourAnswer + ' : fausse');
        eye.click();
        assert.equal(window.document.querySelector('.complete-response-tooltip:not([hidden])').textContent, labels.yourAnswer + ' : fausse');
        eye.parentElement.dispatchEvent(new window.MouseEvent('mouseleave'));
        assert.equal(window.document.querySelector('.complete-response-tooltip').hidden, false);
        window.document.body.dispatchEvent(new window.MouseEvent('click', {bubbles:true}));
        assert.equal(window.document.querySelector('.complete-response-tooltip').hidden, true);
        eye.parentElement.dispatchEvent(new window.MouseEvent('mouseenter'));
        assert.equal(window.document.querySelector('.complete-response-tooltip').hidden, false);
        eye.parentElement.dispatchEvent(new window.MouseEvent('mouseleave'));
        assert.equal(window.document.querySelector('.complete-response-tooltip').hidden, true);
      }
      assert.equal(kind === 'list' ? root.querySelector('select,input').disabled : root.querySelector('select,input').readOnly, true, 'review must freeze responses');
      assert.equal(corrections(), Number(!passed && reveal && maxAttempts > 0 && attempt === maxAttempts));
      click('[data-complete-primary]');
      if (attempt < maxAttempts) click('[data-complete-restart]');
    }
    click('[data-complete-finish]');
    if (reveal && maxAttempts === 0) {
      assert.equal(continuations, 0, 'opening final review must not release progression');
      assert.equal(corrections(), Number(!passed));
      assert.equal(root.querySelector('select,input').value, 'attendue');
      assert.equal(root.querySelector('[data-complete-primary]').textContent, labels.continue);
      click('[data-complete-primary]');
    }
    assert.equal(continuations, 1, 'completion must happen once, after the final review if required');
    await window.happyDOM.abort();
    console.log(`Complete final review: kind=${kind}, passed=${passed}, reveal=${reveal}, attempts=${maxAttempts} OK`);
  }
}

}
}
