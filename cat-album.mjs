import {episodes} from './cat-album-episodes.mjs';

const entry = document.getElementById('cat-album-entry');
const dialog = document.getElementById('cat-album');

if (entry && typeof dialog?.showModal === 'function') {
  const close = document.getElementById('cat-album-close');
  const scroll = document.getElementById('cat-album-scroll');
  const picker = document.getElementById('cat-album-picker');
  const count = document.getElementById('cat-album-count');
  const title = document.getElementById('cat-album-episode-title');
  const caption = document.getElementById('cat-album-caption');
  const page = document.getElementById('cat-album-page');
  const error = document.getElementById('cat-album-error');
  let current = 0;
  for (const episode of episodes) picker.add(new Option(episode.title, episode.file));

  function render() {
    const episode = episodes[current];
    picker.selectedIndex = current;
    count.textContent = `${current + 1} / ${episodes.length}`;
    title.textContent = episode.title;
    caption.textContent = episode.caption;
    page.width = episode.width;
    page.height = episode.height;
    page.alt = episode.alt;
    page.hidden = false;
    error.hidden = true;
    page.src = './' + episode.file;
    scroll.scrollTop = 0;
  }

  function turn(offset) {
    current = (current + offset + episodes.length) % episodes.length;
    render();
  }

  entry.setAttribute('aria-haspopup', 'dialog');
  entry.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.altKey ||
        event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    if (!dialog.open) {
      render();
      dialog.showModal();
      close.focus();
    }
  });
  document.getElementById('cat-album-prev').addEventListener('click', () => turn(-1));
  document.getElementById('cat-album-next').addEventListener('click', () => turn(1));
  picker.addEventListener('change', () => {
    if (picker.selectedIndex < 0) return;
    current = picker.selectedIndex;
    render();
  });
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => entry.focus({preventScroll:true}));
  page.addEventListener('error', () => {
    page.hidden = true;
    error.hidden = false;
  });
}
