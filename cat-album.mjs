const episodes = [
  {
    title:'替身计划，只撑了三秒',
    caption:'波比打印了一个替身，以为自己终于能清静一会儿。',
    src:'./cat-comic-substitute.jpg', width:1122, height:1402,
    alt:'四格漫画。波比打印了一个替身。嘿姆打量替身，波比却先按捺不住，最后被追的还是波比。',
  },
  {
    title:'老板还没起床',
    caption:'老板还没醒，工作室已经开工了。',
    src:'./cat-comic-boss.jpg', width:1024, height:1536,
    alt:'三格漫画。嘿姆招呼大家开会，接着追着波比跑。三只猫把早上的热闹都包办了。',
  },
  {
    title:'保温测试',
    caption:'阳光挪了窝，波比没挪成。',
    src:'./cat-comic-warmth.jpg', width:1122, height:1402,
    alt:'四格漫画。阳光移开了，波比想继续晒太阳，却没能顺利挪到新的位置。',
  },
];

const entry = document.getElementById('cat-album-entry');
const dialog = document.getElementById('cat-album');

if (entry && typeof dialog?.showModal === 'function') {
  const close = document.getElementById('cat-album-close');
  const scroll = document.getElementById('cat-album-scroll');
  const count = document.getElementById('cat-album-count');
  const title = document.getElementById('cat-album-episode-title');
  const caption = document.getElementById('cat-album-caption');
  const page = document.getElementById('cat-album-page');
  const error = document.getElementById('cat-album-error');
  let current = 0;

  function render() {
    const episode = episodes[current];
    count.textContent = `${current + 1} / ${episodes.length}`;
    title.textContent = episode.title;
    caption.textContent = episode.caption;
    page.width = episode.width;
    page.height = episode.height;
    page.alt = episode.alt;
    page.hidden = false;
    error.hidden = true;
    page.src = episode.src;
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
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => entry.focus({preventScroll:true}));
  page.addEventListener('error', () => {
    page.hidden = true;
    error.hidden = false;
  });
}
