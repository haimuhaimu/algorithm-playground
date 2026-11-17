import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {episodes} from '../../src/home/album/cat-album-episodes.mjs';

let bootId = 0;

async function boot(t, {modalSupported = true, modalFails = false} = {}) {
  const html = await readFile(new URL('../../src/home/index.html', import.meta.url), 'utf8');
  const nodes = new Map();
  const document = {activeElement: null, getElementById: id => nodes.get(id) ?? null};
  class Element {
    constructor(markup) {
      this.listeners = new Map();
      this.attributes = Object.fromEntries([...markup.matchAll(/\b([\w-]+)="([^"]*)"/g)]
        .map(([, name, value]) => [name, value]));
      this.hidden = /\shidden(?:\s|>)/.test(markup);
      this.textContent = '';
      this.scrollTop = 0;
      this.options = [];
      this.selectedIndex = -1;
    }
    setAttribute(name, value) { this.attributes[name] = String(value); }
    getAttribute(name) { return this.attributes[name] ?? null; }
    addEventListener(type, listener) {
      if (!this.listeners.has(type)) this.listeners.set(type, []);
      this.listeners.get(type).push(listener);
    }
    dispatchEvent(event) {
      // Browser dispatch reports handler exceptions without cancelling navigation.
      const errors = [];
      for (const listener of this.listeners.get(event.type) ?? []) {
        try { listener(event); } catch (error) { errors.push(error); }
      }
      return errors;
    }
    focus() { document.activeElement = this; }
    add(option) {
      this.options.push(option);
      if (this.selectedIndex < 0) this.selectedIndex = 0;
    }
  }
  for (const [markup, id] of html.matchAll(/<[^<>]+\bid="(cat-album[^" ]*)"[^<>]*>/g)) {
    nodes.set(id, new Element(markup));
  }
  const get = suffix => nodes.get('cat-album' + (suffix ? '-' + suffix : ''));
  const dialog = get('');
  dialog.open = false;
  if (modalSupported) dialog.showModal = () => {
    if (modalFails) throw new DOMException('The dialog cannot open in this document', 'InvalidStateError');
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
    dialog.dispatchEvent(new Event('close'));
  };
  function Option(text, value) { this.text = text; this.textContent = text; this.value = value; }
  for (const [key, value] of Object.entries({document, Option})) {
    const prior = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, {value, configurable: true});
    t.after(() => prior ? Object.defineProperty(globalThis, key, prior) : delete globalThis[key]);
  }
  await import(`../../src/home/album/cat-album.mjs?album-ui-test=${++bootId}`);
  const fire = (suffix, type = 'click', fields = {}) => {
    const event = Object.assign(new Event(type, {cancelable: true}), {
      button: 0, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...fields,
    });
    const errors = get(suffix).dispatchEvent(event);
    return {event, errors};
  };
  return {document, dialog, get, fire};
}

test('an ordinary album click opens the complete published selection and first comic', async t => {
  const ui = await boot(t);
  const {event, errors} = ui.fire('entry');
  assert.deepEqual(errors, []);
  assert.equal(event.defaultPrevented, true);
  assert.equal(ui.dialog.open, true);
  assert.equal(ui.get('picker').options.length, 24);
  assert.deepEqual(ui.get('picker').options.map(option => [option.text, option.value]),
    episodes.map(episode => [episode.title, episode.file]));
  assert.equal(ui.get('count').textContent, '1 / 24');
  assert.equal(ui.get('episode-title').textContent, '待机声');
  assert.equal(ui.get('page').src, './cat-comic-standby-sound.jpg');
  assert.equal(ui.get('page').hidden, false);
  assert.equal(ui.get('error').hidden, true);
  assert.equal(ui.document.activeElement, ui.get('close'));
});

test('next and previous change the displayed comic and wrap through the complete album', async t => {
  const ui = await boot(t);
  ui.fire('entry');
  ui.get('scroll').scrollTop = 500;
  ui.fire('next');
  assert.equal(ui.get('count').textContent, '2 / 24');
  assert.equal(ui.get('episode-title').textContent, '第三个出口');
  assert.equal(ui.get('page').src, './cat-comic-third-exit.jpg');
  assert.equal(ui.get('picker').selectedIndex, 1);
  assert.equal(ui.get('scroll').scrollTop, 0);
  ui.fire('prev');
  assert.equal(ui.get('page').src, './cat-comic-standby-sound.jpg');
  ui.fire('prev');
  assert.equal(ui.get('count').textContent, '24 / 24');
  assert.equal(ui.get('page').src, './cat-comic-warmth.jpg');
  ui.fire('next');
  assert.equal(ui.get('count').textContent, '1 / 24');
  assert.equal(ui.get('page').src, './cat-comic-standby-sound.jpg');
});

test('choosing the last episode renders its own caption, image and accessible description', async t => {
  const ui = await boot(t);
  ui.fire('entry');
  ui.get('picker').selectedIndex = 23;
  ui.fire('picker', 'change');
  assert.equal(ui.get('count').textContent, '24 / 24');
  assert.equal(ui.get('episode-title').textContent, '保温测试');
  assert.equal(ui.get('caption').textContent, '阳光挪了窝，波比没挪成。');
  assert.equal(ui.get('page').src, './cat-comic-warmth.jpg');
  assert.equal(ui.get('page').alt, '四格漫画。阳光移开了，波比想继续晒太阳，却没能顺利挪到新的位置。');
  assert.equal(ui.get('page').width, 1122);
  assert.equal(ui.get('page').height, 1402);
});

test('closing the album returns focus to the original homepage entry', async t => {
  const ui = await boot(t);
  ui.fire('entry');
  ui.fire('close');
  assert.equal(ui.dialog.open, false);
  assert.equal(ui.document.activeElement, ui.get('entry'));
});

test('modified and non-primary clicks retain the original link instead of opening a modal', async t => {
  const ui = await boot(t);
  const href = ui.get('entry').getAttribute('href');
  for (const fields of [{altKey: true}, {ctrlKey: true}, {metaKey: true}, {shiftKey: true}, {button: 1}]) {
    const {event, errors} = ui.fire('entry', 'click', fields);
    assert.deepEqual(errors, []);
    assert.equal(event.defaultPrevented, false);
    assert.equal(ui.dialog.open, false);
    assert.equal(ui.get('entry').getAttribute('href'), href);
  }
});

test('browsers without native modal support keep the entry link available', async t => {
  const ui = await boot(t, {modalSupported: false});
  const {event, errors} = ui.fire('entry');
  assert.deepEqual(errors, []);
  assert.equal(event.defaultPrevented, false);
  assert.equal(ui.dialog.open, false);
});

test('a failed showModal leaves native link navigation available instead of trapping the visitor', async t => {
  const ui = await boot(t, {modalFails: true});
  ui.get('entry').focus();
  const {event, errors} = ui.fire('entry');
  assert.equal(event.defaultPrevented, false, 'the full album link must remain usable when the modal cannot open');
  assert.deepEqual(errors, [], 'the controller handles the modal failure');
  assert.equal(ui.dialog.open, false);
  assert.equal(ui.document.activeElement, ui.get('entry'));
});
