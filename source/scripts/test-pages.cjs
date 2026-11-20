async function smoke(browser, BASE) {
  const configs = {
    desktop: { viewport: { width: 1440, height: 900 } },
    iphone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' }
  };
  const results = {};
  for (const [name, cfg] of Object.entries(configs)) {
    const ctx = await browser.newContext(cfg);
    const p = await ctx.newPage();
    p.setDefaultTimeout(15000);
    const errs = [], bad = [], log = [];
    const watch = pg => {
      pg.on('pageerror', e => errs.push('pageerror: ' + e.message));
      pg.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)); });
      pg.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url().slice(-90)); });
      pg.on('requestfailed', r => { if (!/fonts\.g/.test(r.url())) bad.push('FAILED ' + r.url().slice(-90)); });
    };
    watch(p);
    const ok = (label, cond, extra = '') => log.push(`${cond ? 'PASS' : 'FAIL'} ${label}${extra ? ' — ' + extra : ''}`);

    try {
      await p.goto(BASE, { waitUntil: 'domcontentloaded' });
      await p.waitForURL(/\/app\//, { timeout: 10000 });
      ok('root opens the app', /\/app\//.test(p.url()), p.url());
      const app = p.mainFrame();
      const desk = name === 'desktop';
      const btn = (n, opts = {}) => app.getByRole('button', { name: n, ...opts });
      const tap = async (n, opts) => { await btn(n, opts).click(); await p.waitForTimeout(700); };
      const tab = async t => { await (desk ? app.getByRole('tab', { name: t, exact: true }) : btn(new RegExp('^' + t + ', tab'))).click(); await p.waitForTimeout(1200); };
      const text = () => app.innerText('body');

      await app.getByText('Get started', { exact: true }).first().waitFor({ timeout: 15000 });
      ok('welcome screen', true);

      await p.waitForTimeout(1500);
      await app.getByText('Get started', { exact: true }).last().click();
      const dept = await app.getByText('What do you shop for?').waitFor({ timeout: 10000 }).then(() => true, () => false);
      ok('department step', dept, app.url());
      await tap(/^Menswear/); await tap('Continue');
      let steps = 0;
      for (let i = 0; i < 8; i++) {
        if (!/Would you wear this/.test(await text())) break;
        await tap(i % 3 === 2 ? 'Not for me' : 'I would wear this', { exact: true });
        steps++;
      }
      ok('taste quiz 8 answers', steps === 8, String(steps));
      ok('fit step', (await text()).includes('How should things'));
      await app.getByText('M', { exact: true }).first().click();
      await app.getByText('Easy', { exact: true }).click();
      await app.getByText('Compose my edit', { exact: true }).click();
      await app.getByText('See all 6 looks', { exact: true }).waitFor({ timeout: 15000 });
      ok('edit composed', (await text()).includes('YOUR EDIT IS READY'));

      await app.getByText('See all 6 looks', { exact: true }).click(); await p.waitForTimeout(1500);
      ok('home feed', /\/home/.test(app.url()) && /\/ 100|of 100 pieces/.test(await text()));
      if (desk) {
        const pass = btn(/^Pass on /).first();
        const front = await pass.getAttribute('aria-label');
        await pass.focus();
        await p.keyboard.press('ArrowRight');
        await p.waitForTimeout(500);
        ok('focused controls keep arrow keys from reviewing the deck', await pass.getAttribute('aria-label') === front);
        await p.keyboard.press('Enter');
        await p.waitForTimeout(550);
        ok('Enter activates the focused Pass button without opening details',
          /\/home/.test(p.url()) && await pass.getAttribute('aria-label').catch(() => null) !== front, p.url());
        if (!/\/home/.test(p.url())) await p.goBack();
        await pass.waitFor();
        await p.evaluate(() => document.activeElement.blur());
        const next = await pass.getAttribute('aria-label');
        await p.keyboard.press('ArrowLeft');
        await p.waitForTimeout(550);
        ok('keyboard pass', await pass.getAttribute('aria-label') !== next);
        await p.keyboard.press('z');
        await p.waitForTimeout(550);
        ok('keyboard undo restores the card', await pass.getAttribute('aria-label') === next);
        await p.keyboard.press('Enter');
        await p.waitForURL(/\/product\?/);
        ok('keyboard details', true);
        await p.goBack();
        await pass.waitFor();
        await p.evaluate(() => document.activeElement.blur());
      }
      if (desk) {
        const savedTotal = app.getByRole('link', { name: /^\d+ pieces? · \d+ looks?/ });
        const before = Number.parseInt(await savedTotal.innerText(), 10);
        await p.keyboard.press('ArrowRight');
        await p.waitForTimeout(550);
        ok('keyboard save increments saved pieces', Number.parseInt(await savedTotal.innerText(), 10) === before + 1);
      }
      else { await btn(/^Save /).first().click(); await p.waitForTimeout(800); }

      await tap('Complete looks');
      ok('complete looks', (await text()).includes('COMPLETE LOOK'));
      await app.getByText('Save look', { exact: true }).last().click(); await p.waitForTimeout(900);

      await tab('Edits');
      ok('edits tab', /\/edits/.test(app.url()));

      await app.getByText('Try it on', { exact: true }).click(); await p.waitForTimeout(1500);
      const tryText = await text();
      ok('try-on screen', /\/tryon/.test(app.url()) && tryText.includes('Your try-on'));
      ok('try-on explains not connected', tryText.includes('isn’t connected'));

      await tab('Saved');
      const savedText = await text();
      const counts = savedText.match(/Pieces\s*(\d+)\s*\n?Looks\s*(\d+)/);
      ok('saved shows piece + look', counts && Number(counts[1]) >= 1 && Number(counts[2]) >= 1, counts ? counts.slice(1).join('/') : 'no counts');

      await tab('You');
      ok('you tab', (await text()).includes('Your FORM.'));

      await tab('For You');

      // Deep link reload must survive (404.html fallback)
      const deep = BASE + 'app/saved';
      const dp = await ctx.newPage(); watch(dp);
      const resp = await dp.goto(deep, { waitUntil: 'domcontentloaded' });
      await dp.waitForTimeout(1500);
      const deepText = await dp.innerText('body');
      ok('deep link reload works', resp.status() === 200 && deepText.includes('Saved') && deepText.includes('Pieces'), `status ${resp.status()}`);
      await dp.close();

      if (desk) {
        await app.getByRole('button', { name: 'Start over' }).click();
        await app.getByText('Get started', { exact: true }).first().waitFor({ timeout: 15000 });
        ok('start over returns to the cover', !(await text()).includes('Back to my wardrobe'));

      }
      const overflow = await app.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      ok('no horizontal overflow', !overflow);
    } catch (e) {
      ok('run completed', false, e.message.split('\n')[0]);
    }

    if (name === 'desktop') {
      // The landing scene: drag a piece onto the figure, flick one away, answer the rest, and open the app already set up.
      const lab = await ctx.browser().newContext(cfg), lp = await lab.newPage(); watch(lp);
      try {
        await lp.goto(BASE, { waitUntil: 'domcontentloaded' });
        await lp.getByText('Drag it onto the figure', { exact: false }).waitFor({ timeout: 15000 });
        await lp.waitForTimeout(1500);
        const head = () => lp.getByRole('heading', { level: 1 }).first().getAttribute('aria-label');
        ok('lab greets with the moment', /It’s \d+:\d\d on an? /.test(await lp.innerText('body')) && /dress you/.test(await head()));
        const front = async () => {
          const els = lp.locator('[data-lab="piece"]'); let best = null;
          for (let i = 0; i < await els.count(); i++) { const b = await els.nth(i).boundingBox(); if (b && (!best || b.width * b.height > best.width * best.height)) best = b; }
          return best;
        };
        const fig = await lp.locator('.lab-figure').boundingBox();
        let b = await front();
        await lp.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await lp.mouse.down();
        for (let i = 1; i <= 16; i++) { await lp.mouse.move(b.x + b.width / 2 + (fig.x + fig.width / 2 - b.x - b.width / 2) * i / 16, b.y + b.height / 2 + (fig.y + fig.height * 0.35 - b.y - b.height / 2) * i / 16); await lp.waitForTimeout(16); }
        await lp.mouse.up(); await lp.waitForTimeout(1300);
        const ticks = async k => lp.locator('.lab-ticks span.' + k).count();
        ok('lab: dragging onto the figure wears it', await ticks('on') === 1 && !/dress you/.test(await head()));
        b = await front();
        await lp.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await lp.mouse.down();
        for (let i = 1; i <= 5; i++) await lp.mouse.move(b.x + b.width / 2 + i * 90, b.y + b.height / 2 - i * 50);
        await lp.mouse.up(); await lp.waitForTimeout(1300);
        ok('lab: a flick passes', await ticks('no') === 1);
        for (let i = 0; i < 2; i++) { await lp.getByRole('button', { name: i ? '← Pass' : 'Wear it →' }).click(); await lp.waitForTimeout(700); }
        const cta = lp.getByRole('button', { name: /^See my looks/ });
        await cta.waitFor({ timeout: 10000 });
        ok('lab: edit ready after 4 answers', /Your edit is ready/.test(await head()) && await ticks('on') === 2);
        await cta.click(); await lp.waitForURL(/\/home/, { timeout: 15000 }); await lp.waitForTimeout(1500);
        ok('lab: opens the app already set up', /of \d+ pieces in today/.test(await lp.innerText('body')), lp.url());
      } catch (e) {
        ok('lab run completed', false, e.message.split('\n')[0]);
      }
      await lab.close();
    }

    results[name] = { log, errs: [...new Set(errs)], bad: [...new Set(bad)] };
    await ctx.close();
  }
  return results;
}


const { chromium } = require('playwright');
(async () => {
  const base = new URL(process.argv[2] || 'https://thomascaruso.github.io/form-interactive-exam/');
  const browser = await chromium.launch({ executablePath: process.env.FORM_CHROMIUM_PATH });
  try {
    const results = await smoke(browser, base.href);
    console.log(JSON.stringify(results, null, 2));
    if (Object.values(results).some(result =>
      result.log.some(line => line.startsWith('FAIL')) || result.errs.length || result.bad.length
    )) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
