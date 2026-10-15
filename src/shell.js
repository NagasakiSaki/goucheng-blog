import {escapeHTML as esc} from './model.js';
export const arrow = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19 19 5M5 5h14v14" stroke="currentColor" stroke-width="1.6"/></svg>';
export const searchIcon = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.7"/><path d="m16 16 5 5" stroke="currentColor" stroke-width="1.7"/></svg>';
export const shell = ({site,author}) => `
  <header class="header"><a class="brand" href="#" aria-label="构成，回到首页"><span class="brand-symbol"><i></i><b></b></span><span class="brand-title">${esc(site.title)}<span class="brand-en">${esc(site.english)}</span></span></a>
    <nav aria-label="主导航"><a class="nav-active" href="#journal">文章<span>JOURNAL</span></a><button data-action="archive">归档<span>ARCHIVE</span></button><button data-action="about">关于<span>ABOUT</span></button><button data-action="library">阅读清单<span>LIBRARY</span></button></nav>
    <div class="header-tools"><button class="theme-toggle" data-action="theme" aria-label="切换夜间模式">◐</button><button class="search-button" data-action="search" aria-label="搜索文章">${searchIcon}<span>搜索</span><kbd>/</kbd></button><button class="studio-entry" data-action="studio">创作中心 ↗</button></div>
  </header>
  <main>
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-copy"><div class="eyebrow"><span class="tiny-square"></span> ${esc(site.tagline)}</div>
        <h1 id="hero-title">把日常，<br>重新<span class="red-word">构成<span class="word-star">✳</span></span>。</h1>
        <p class="hero-description">${esc(site.description)}</p>
        <a class="primary-button" href="#journal">开始阅读 <span>↘</span></a>
        <div class="hero-bottom"><span>独立记录 · 持续生长</span><span>EST. 2026</span></div>
      </div>
      <div class="hero-art" aria-label="由圆形、斜线和文字构成的构成主义艺术海报" role="img">
        <div class="poster-top"><span>NOTES ON LIFE & DESIGN</span><span>VOL. 001</span></div>
        <div class="poster-ring"></div><div class="poster-circle"></div><div class="poster-diagonal"></div><div class="poster-outline"></div>
        <div class="poster-type"><span class="poster-first">MAKE</span><br><span class="poster-room">ROOM</span><br><span class="poster-last">FOR IDEAS.</span></div>
        <span class="poster-side">THINK / CREATE / REPEAT</span><div class="poster-bottom"><span>让想法，自由发生。</span><span>↗</span></div>
      </div>
    </section>
    <div class="manifesto-strip" aria-hidden="true"><span>观察 OBSERVE</span><i>✳</i><span>思考 THINK</span><i>✳</i><span>创造 CREATE</span><i>✳</i><span>记录 DOCUMENT</span><i>✳</i><span class="strip-end">保持好奇 STAY CURIOUS</span></div>
    <section class="journal section-wrap" id="journal" aria-labelledby="journal-title">
      <div class="section-heading"><div><span class="section-number">01 / THE JOURNAL</span><h2 id="journal-title">写下，才有形状<span class="red-dot">.</span></h2></div><span class="section-caption">一些想法，一些生活，一些正在发生的事。</span></div>
      <div class="journal-overview"><span id="blog-counts"></span><button data-action="tags">探索标签 ↗</button><button data-action="random">随机一篇 ↗</button></div>
      <div class="filter-bar"><div class="filters" id="categories" aria-label="文章分类"></div><button class="saved-filter" data-action="saved" aria-pressed="false"><span>☆</span> 我的收藏</button></div>
      <div class="browse-tools"><label class="inline-search">${searchIcon}<input id="inline-query" type="search" placeholder="搜索文章、标签或正文" aria-label="筛选文章"></label><select id="sort-order" aria-label="文章排序"><option value="newest">最新发布</option><option value="oldest">最早发布</option><option value="popular">本机阅读最多</option><option value="shortest">阅读时间最短</option></select><label class="unread-toggle"><input id="unread-only" type="checkbox">只看未读</label><button data-action="layout" class="layout-toggle" aria-label="切换列表布局">☷</button></div>
      <div id="active-filters"></div>
      <div id="filter-description" class="filter-description" aria-live="polite"></div><div id="articles"></div>
      <div id="pagination" class="pagination"></div><div class="journal-end"><span>— 每一篇，都是思考留下的痕迹 —</span><button data-action="archive">查看全部归档 ${arrow}</button></div>
    </section>
    <section class="about-section section-wrap" id="about"><div class="about-art" aria-hidden="true"><div class="about-orbit"></div><div class="about-block"></div><span>HELLO,<br>WORLD<span class="red-dot">.</span></span><small>A PERSON, IN PROGRESS.</small></div><div class="about-copy"><span class="section-number">02 / BEHIND THE WORDS</span><h2>嗨，我是${esc(author.name)}<span class="red-dot">。</span></h2><div class="author-role">${esc(author.role)}</div><p>${esc(author.bio)}</p><button class="text-button" data-action="about">多了解我一点 ${arrow}</button></div></section>
    <section class="closing section-wrap"><div><span class="section-number">THE STORY CONTINUES</span><h2>保持好奇，<br>我们下次见<span>↗</span></h2></div><div class="closing-right"><p>好想法值得慢慢酝酿。<br>把这里留在你的阅读清单里，偶尔回来坐坐。</p><button class="primary-button" data-action="copy-link">复制博客链接 ${arrow}</button><button class="rss-button" data-action="rss">↗ 下载 RSS 订阅源</button></div></section>
  </main>
  <footer class="footer"><a class="footer-brand" href="#">${esc(site.title)} / ${esc(site.english)}</a><span>© 2026 ${esc(author.name)} · 用文字构筑一个小小的世界</span><div class="footer-links"><button data-action="help">使用说明</button><button data-action="studio">管理博客</button><button data-action="top">回到顶部 ↑</button></div></footer>
`;
