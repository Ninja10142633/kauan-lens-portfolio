import { supabase } from './supabase';
import { escapeHtml, formatDate } from './utils';

// Estado da Galeria
export let albums = [];
export let activeAlbumId = null;
let lightboxItems = [];
let curIdx = 0;

// Helper to check if a filename is a raw camera or device generated format
export function isRawFilename(name) {
  if (!name) return true;

  const clean = name.trim();

  return (
    /^IMG_/i.test(clean) ||
    /^DSC/i.test(clean) ||
    /^PXL_/i.test(clean) ||
    /^WhatsApp/i.test(clean) ||
    /^Screenshot/i.test(clean) ||
    /^Captura de tela/i.test(clean) ||
    /^Nova Imagem/i.test(clean) ||
    /^Download/i.test(clean) ||
    /^Foto[\s_-]*\(?\d+\)?/i.test(clean) ||
    /^Imagem[\s_-]*\(?\d+\)?/i.test(clean) ||
    /^Image[\s_-]*\(?\d+\)?/i.test(clean) ||
    /^\d{8}_\d{6}/i.test(clean)
  );
}

// Computes the visitor-friendly description of a photo based on priority
export function getPhotoDescription(photo, album) {
  if (photo.description?.trim()) {
    return photo.description.trim();
  }
  if (photo.title?.trim() && !isRawFilename(photo.title)) {
    return photo.title.trim();
  }
  if (album?.title?.trim()) {
    return album.title.trim();
  }
  return "Registro realizado por Kauan Lens.";
}

// Funções Auxiliares para o Sistema de Favoritos (Persistidos localmente)
export function getFavorites() {
  try {
    const list = JSON.parse(localStorage.getItem('kauanLensFavorites') || '[]');
    return list.map(photo => {
      const isRaw = isRawFilename(photo.name);
      return {
        ...photo,
        file_name: photo.name,
        title: isRaw ? undefined : photo.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ")
      };
    });
  } catch (err) {
    return [];
  }
}

export function saveFavorites(favorites) {
  try {
    localStorage.setItem('kauanLensFavorites', JSON.stringify(favorites));
  } catch (err) {
    console.error('Erro ao salvar favoritos:', err);
  }
}

export function isPhotoFavorited(photoSrc) {
  const favorites = getFavorites();
  return favorites.some(p => p.src === photoSrc);
}

// Elementos da DOM
let albumTabs, albumView, lb, lbImgWrap, lbPlaceholder, lbTitle, lbMeta, lbFav, lbDesc;

/**
 * Inicializa os observadores e referências da galeria
 */
export function initGallery() {
  albumTabs = document.getElementById('albumTabs');
  albumView = document.getElementById('albumView');
  lb = document.getElementById('lb');
  lbImgWrap = document.getElementById('lbImgWrap');
  lbPlaceholder = document.getElementById('lbPlaceholder');
  lbTitle = document.getElementById('lbTitle');
  lbMeta = document.getElementById('lbMeta');
  lbFav = document.getElementById('lbFav');
  lbDesc = document.getElementById('lbDesc');

  // Registrar eventos do Lightbox
  document.getElementById('lbClose')?.addEventListener('click', closeLb);
  document.getElementById('lbCloseBtn')?.addEventListener('click', closeLb);
  document.getElementById('lbPrevBtn')?.addEventListener('click', () => navLb(-1));
  document.getElementById('lbNextBtn')?.addEventListener('click', () => navLb(1));
  lbFav?.addEventListener('click', () => toggleFav(lbFav));

  // Fechar ao clicar fora
  lb?.addEventListener('click', function (e) {
    if (e.target === this || e.target === lbImgWrap) {
      closeLb();
    }
  });

  // Atalhos de teclado
  document.addEventListener('keydown', e => {
    if (!lb || !lb.classList.contains('open')) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowRight') navLb(1);
    if (e.key === 'ArrowLeft') navLb(-1);
  });

  // Gestos de deslizar em Touch
  let touchstartX = 0;
  let touchendX = 0;

  lbImgWrap?.addEventListener('touchstart', e => {
    touchstartX = e.changedTouches[0].screenX;
  }, { passive: true });

  lbImgWrap?.addEventListener('touchend', e => {
    touchendX = e.changedTouches[0].screenX;
    if (touchendX < touchstartX - 60) navLb(1); // Swipe left -> Prox
    if (touchendX > touchstartX + 60) navLb(-1); // Swipe right -> Ant
  }, { passive: true });
}

/**
 * Renderiza skeletons de carregamento
 */
export function renderSkeletons() {
  if (albumTabs) {
    albumTabs.innerHTML = `
      <div class="skeleton skeleton-tab-item"></div>
      <div class="skeleton skeleton-tab-item"></div>
      <div class="skeleton skeleton-tab-item"></div>
    `;
  }
  if (albumView) {
    albumView.innerHTML = `
      <div class="album-view-head">
        <div class="skeleton" style="height: 35px; width: 60%; margin-bottom: 0.5rem;"></div>
        <div class="skeleton" style="height: 15px; width: 25%;"></div>
      </div>
      <div class="skeleton-grid">
        <div class="skeleton skeleton-grid-item"></div>
        <div class="skeleton skeleton-grid-item" style="height: 350px;"></div>
        <div class="skeleton skeleton-grid-item" style="height: 220px;"></div>
      </div>
    `;
  }
}

/**
 * Carrega a lista pública de álbuns
 */
export async function carregarAlbums(sharedSlug = null) {
  renderSkeletons();

  if (supabase) {
    try {
      // Carrega álbuns publicados e não excluídos, ordenados por sort_order
      let query = supabase
        .from('albums')
        .select(`
          *,
          photos (*)
        `)
        .is('deleted_at', null)
        .eq('status', 'published')
        .order('sort_order', { ascending: true })
        .order('date', { ascending: false });

      const { data: dbAlbums, error } = await query;
      if (error) throw error;

      // Filtra fotos soft-deletadas e ordena fotos relacionais por sort_order
      albums = dbAlbums.map(album => {
        const activePhotos = (album.photos || []).filter(p => !p.deleted_at).map(p => {
          const isRaw = isRawFilename(p.name);
          return {
            ...p,
            file_name: p.name,
            title: isRaw ? undefined : p.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ")
          };
        });
        const sortedPhotos = activePhotos.sort((a, b) => a.sort_order - b.sort_order);
        return { ...album, photos: sortedPhotos };
      });

    } catch (err) {
      console.error('Erro ao carregar dados do Supabase, carregando local...', err);
      carregarLocalFallback();
    }
  } else {
    carregarLocalFallback();
  }

  // Verifica se o roteador abriu um link direto de álbum compartilhado
  if (sharedSlug) {
    const sharedAlbum = albums.find(a => a.slug === sharedSlug);
    if (sharedAlbum) {
      activeAlbumId = sharedAlbum.id;
    }
  }

  renderAlbums();
  atualizarDestaqueHero();
}

/**
 * Fallback de localStorage
 */
function carregarLocalFallback() {
  try {
    albums = JSON.parse(localStorage.getItem('kauanLensAlbums') || '[]');
  } catch (err) {
    albums = [];
  }
}

/**
 * Atualiza o fundo do Hero com a foto marcada como Destaque
 */
export function atualizarDestaqueHero() {
  const heroImageDiv = document.getElementById('heroImage');
  const heroImg = document.getElementById('heroImg');
  const heroMetaCam = document.getElementById('heroMetaCam');
  if (!heroImageDiv || !heroImg) return;

  // 1. Procurar foto de destaque em qualquer álbum ativo
  let featuredPhoto = null;
  for (const album of albums) {
    featuredPhoto = album.photos.find(p => p.is_featured && !p.deleted_at);
    if (featuredPhoto) break;
  }

  // 2. Se não encontrar, buscar a primeira foto do álbum que é destaque
  if (!featuredPhoto) {
    const featuredAlbum = albums.find(a => a.is_featured);
    if (featuredAlbum && featuredAlbum.photos.length) {
      featuredPhoto = featuredAlbum.photos[0];
    }
  }

  // 3. Se ainda não houver, pegar a primeira foto de qualquer álbum
  if (!featuredPhoto && albums.length && albums[0].photos.length) {
    featuredPhoto = albums[0].photos[0];
  }

  // Atualizar fundo
  if (featuredPhoto) {
    // Usar optimized_src se disponível, senão src normal
    const src = featuredPhoto.src;
    heroImg.src = src;
    heroImageDiv.style.display = 'block';

    // Opcional: atualizar metadados técnicos do Hero com base na foto de destaque se houver
    if (heroMetaCam) {
      const details = [];
      const album = albums.find(a => a.photos.some(p => p.id === featuredPhoto.id));
      const cleanDesc = getPhotoDescription(featuredPhoto, album);
      if (cleanDesc && cleanDesc !== "Registro realizado por Kauan Lens." && (!album || cleanDesc !== album.title)) {
        details.push(cleanDesc);
      }
      details.push('f/1.8 · 1/250s · ISO 200');
      details.push('LEM, BA · Cerrado');
      heroMetaCam.innerHTML = details.join('<br>');
    }
  } else {
    // Fallback: Tenta carregar hero.jpg estático. Se der erro, oculta.
    heroImg.src = 'assets/hero.jpg';
    heroImg.onload = () => { heroImageDiv.style.display = 'block'; };
    heroImg.onerror = () => { heroImageDiv.style.display = 'none'; };
  }
}

/**
 * Renderiza a lista de álbuns (abas) e o álbum ativo
 */
export function renderAlbums() {
  if (!albumTabs || !albumView) return;

  const favorites = getFavorites();
  const hasFavs = favorites.length > 0;

  // Se o álbum ativo era o virtual e não há mais favoritos, volta pro primeiro
  if (activeAlbumId === 'favorites-virtual-album' && !hasFavs) {
    activeAlbumId = albums[0]?.id || null;
  }

  // Se não houver álbuns normais E não houver favoritos
  if (!albums.length && !hasFavs) {
    albumTabs.innerHTML = '';
    albumView.innerHTML = `
      <div class="album-empty">
        <div class="album-empty-inner">
          <p class="album-empty-kicker">Galeria</p>
          <h3 class="album-empty-title">Em breve</h3>
          <p class="album-empty-copy">Novos registros fotográficos estão sendo preparados.</p>
        </div>
      </div>
    `;
    return;
  }

  // Define álbum ativo inicial se necessário
  if (!activeAlbumId || 
      (activeAlbumId !== 'favorites-virtual-album' && !albums.some(album => album.id === activeAlbumId)) ||
      (activeAlbumId === 'favorites-virtual-album' && !hasFavs)) {
    activeAlbumId = albums[0]?.id || null;
  }

  // Renderizar abas dos álbuns
  let tabsHtml = albums.map(album => {
    const cover = album.cover_url || (album.photos && album.photos[0] ? album.photos[0].thumbnail_src || album.photos[0].src : '');
    const style = cover ? `style="background-image:url('${cover.replace(/'/g, '%27')}')"` : '';
    const isSelected = album.id === activeAlbumId;
    const classes = `album-card ${cover ? 'has-cover' : ''} ${isSelected ? 'on' : ''}`;

    return `
      <button class="${classes}" ${style} role="tab" aria-selected="${isSelected ? 'true' : 'false'}" onclick="window.selectAlbum('${album.id}')">
        <span class="album-card-content">
          <span class="album-count">${album.photos.length} foto${album.photos.length === 1 ? '' : 's'}</span>
          <span>
            <span class="album-title">${escapeHtml(album.title)}</span>
            <span class="album-meta">${escapeHtml(formatDate(album.date))} · ${escapeHtml(album.local || 'LEM, Bahia')}</span>
          </span>
        </span>
      </button>
    `;
  }).join('');

  // Adiciona a aba dinâmica de favoritos se houver algum item favoritado
  if (hasFavs) {
    const isSelected = activeAlbumId === 'favorites-virtual-album';
    const cover = favorites[0]?.thumbnail_src || favorites[0]?.src || '';
    const style = cover ? `style="background-image:url('${cover.replace(/'/g, '%27')}')"` : '';
    const classes = `album-card virtual-album ${cover ? 'has-cover' : ''} ${isSelected ? 'on' : ''}`;

    tabsHtml += `
      <button class="${classes}" ${style} role="tab" aria-selected="${isSelected ? 'true' : 'false'}" onclick="window.selectAlbum('favorites-virtual-album')">
        <span class="album-card-content">
          <span class="album-count" style="color: #ff5555;">♥ ${favorites.length} foto${favorites.length === 1 ? '' : 's'}</span>
          <span>
            <span class="album-title" style="color: var(--gold);">Minhas Favoritas</span>
            <span class="album-meta">Sua seleção de fotos</span>
          </span>
        </span>
      </button>
    `;
  }

  albumTabs.innerHTML = tabsHtml;

  // Obter o álbum a ser renderizado
  let album;
  if (activeAlbumId === 'favorites-virtual-album' && hasFavs) {
    album = {
      id: 'favorites-virtual-album',
      title: 'Minhas Favoritas',
      date: new Date().toISOString().split('T')[0],
      local: 'Galeria Pessoal',
      cat: 'favoritos',
      note: 'Suas fotos marcadas com coração.',
      photos: favorites
    };
  } else {
    album = albums.find(item => item.id === activeAlbumId);
  }

  if (!album) return;

  const albumUrl = `${window.location.origin}/album/${album.slug}`;

  albumView.innerHTML = `
    <div class="album-view-head">
      <div class="album-view-title-wrap">
        <h3 class="album-view-title">${escapeHtml(album.title)}</h3>
        <p class="album-view-meta">
          ${activeAlbumId === 'favorites-virtual-album' ? 'Sua Coleção Privada' : `${escapeHtml(formatDate(album.date))} · ${escapeHtml(album.local || 'LEM, Bahia')} · ${escapeHtml(album.cat || 'registro')}`}
        </p>
      </div>
      <div style="display:flex; flex-direction:column; gap:0.5rem; align-items:flex-end;">
        ${activeAlbumId !== 'favorites-virtual-album' ? `
          <button class="mini-btn" onclick="navigator.clipboard.writeText('${albumUrl}').then(() => alert('Link copiado!'))" style="min-height:36px;">
            Compartilhar Álbum
          </button>
        ` : ''}
        <p class="album-note" style="margin-top:0.5rem; text-align:right;">
          ${escapeHtml(album.note || '')}
        </p>
      </div>
    </div>
    ${album.photos.length ? `
      <div class="photo-grid">
        ${album.photos.map((photo, index) => {
          const cleanDesc = getPhotoDescription(photo, album);
          const strongTitle = (photo.title && !isRawFilename(photo.title)) ? photo.title : album.title;
          return `
            <div class="photo-item" onclick="window.openAlbumLightbox('${album.id}', ${index})" role="button" aria-label="Visualizar foto ${escapeHtml(cleanDesc)} em tela cheia">
              <img src="${photo.src}" alt="${escapeHtml(cleanDesc)}" loading="lazy" style="aspect-ratio: ${photo.w && photo.h ? `${photo.w} / ${photo.h}` : 'auto'}; height: auto;">
              <div class="photo-overlay">
                <div class="photo-meta">
                  <strong>${escapeHtml(strongTitle)}</strong>
                  ${escapeHtml(album.title)}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : `
      <div class="album-empty">
        <div class="album-empty-inner">
          <p class="album-empty-kicker">Pasta Vazia</p>
          <h3 class="album-empty-title">Sem fotos publicadas</h3>
          <p class="album-empty-copy">Nenhuma foto adicionada neste álbum.</p>
        </div>
      </div>
    `}
  `;

  // Animar a entrada das fotos
  albumView.classList.remove('fade-in-up');
  void albumView.offsetWidth; // Força reflow
  albumView.classList.add('fade-in-up');
}

/**
 * Seleciona um álbum e redesenha a tela
 */
export function selectAlbum(id) {
  activeAlbumId = id;
  renderAlbums();
}
window.selectAlbum = selectAlbum;

/**
 * Carrega um álbum individual em destaque (Shared view)
 */
export async function loadSharedAlbum(slug) {
  if (supabase) {
    try {
      renderSkeletons();
      const { data: dbAlbums, error } = await supabase
        .from('albums')
        .select('*, photos(*)')
        .is('deleted_at', null)
        .eq('status', 'published')
        .eq('slug', slug)
        .limit(1);

      if (error) throw error;

      if (dbAlbums && dbAlbums.length) {
        const album = dbAlbums[0];
        const activePhotos = (album.photos || []).filter(p => !p.deleted_at).map(p => {
          const isRaw = isRawFilename(p.name);
          return {
            ...p,
            file_name: p.name,
            title: isRaw ? undefined : p.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ")
          };
        });
        // Ordena fotos por sort_order
        album.photos = activePhotos.sort((a, b) => a.sort_order - b.sort_order);

        // Substitui a lista de álbuns pelo álbum compartilhado
        albums = [album];
        activeAlbumId = album.id;

        // Injeta tags SEO dinâmicas para compartilhamento
        document.title = `${album.title} | Kauan (lens.by.zy)`;
        document.querySelector("meta[name='description']")?.setAttribute('content', album.note || album.title);
        document.querySelector("meta[property='og:title']")?.setAttribute('content', album.title);
        document.querySelector("meta[property='og:description']")?.setAttribute('content', album.note || album.title);
        if (album.photos.length) {
          document.querySelector("meta[property='og:image']")?.setAttribute('content', album.photos[0].src);
        }

        renderAlbums();
        // Oculta abas no modo compartilhado para dar foco total
        if (albumTabs) albumTabs.style.display = 'none';

        // Scroll direto para o álbum
        document.getElementById('galeria')?.scrollIntoView({ behavior: 'smooth' });
      } else {
        // Redireciona para 404 local
        window.location.href = '/404.html';
      }
    } catch (err) {
      console.error('Falha ao carregar álbum compartilhado:', err);
      window.location.href = '/404.html';
    }
  } else {
    window.location.href = '/404.html';
  }
}

/**
 * Abre o visualizador Lightbox em tela cheia
 */
export function openAlbumLightbox(albumId, index) {
  let album;
  if (albumId === 'favorites-virtual-album') {
    album = {
      id: 'favorites-virtual-album',
      title: 'Minhas Favoritas',
      photos: getFavorites()
    };
  } else {
    album = albums.find(item => item.id === albumId);
  }

  if (!album || !album.photos.length) return;

  lightboxItems = album.photos.map(photo => ({
    ...photo,
    albumId: album.id,
    albumTitle: album.title,
    albumObj: album,
    meta: `${album.title} · ${formatDate(album.date)} · ${album.local || 'LEM, Bahia'}`
  }));

  curIdx = index;
  renderLightboxItem();
  lb.classList.add('open');
  document.body.style.overflow = 'hidden';
}
window.openAlbumLightbox = openAlbumLightbox;

/**
 * Renderiza o slide ativo do Lightbox
 */
function renderLightboxItem() {
  const item = lightboxItems[curIdx];
  if (!item) return;

  const album = item.albumObj;
  const cleanDesc = getPhotoDescription(item, album);
  const strongTitle = (item.title && !isRawFilename(item.title)) ? item.title : (album?.title || '');

  lbTitle.textContent = strongTitle;
  lbMeta.textContent = item.meta || `${item.albumTitle || ''}`;

  lbPlaceholder.className = 'lb-placeholder';
  lbPlaceholder.innerHTML = `<img src="${item.original_src || item.src}" alt="${escapeHtml(cleanDesc)}" id="lbActiveImage" style="opacity:0; transition: opacity 0.3s ease;">`;
  
  // Animar entrada da imagem
  const img = document.getElementById('lbActiveImage');
  if (img) {
    setTimeout(() => { img.style.opacity = 1; }, 50);
  }

  // Atualizar visual do botão favorito
  const isFav = isPhotoFavorited(item.src);
  lbFav.classList.toggle('active', isFav);
  lbFav.textContent = isFav ? '♥ Favoritado' : '♡ Favoritar';

  // Mostrar descrição
  if (lbDesc) {
    lbDesc.textContent = cleanDesc;
    lbDesc.style.display = 'block';
  }
}

/**
 * Fecha o Lightbox
 */
export function closeLb() {
  lb.classList.remove('open');
  document.body.style.overflow = '';
  // Recarrega os álbuns para refletir favoritos adicionados ou removidos
  renderAlbums();
}

/**
 * Navega nos slides do Lightbox
 */
export function navLb(dir) {
  if (!lightboxItems.length) return;

  const img = document.getElementById('lbActiveImage');
  if (img) {
    img.style.opacity = 0;
  }

  setTimeout(() => {
    curIdx = (curIdx + dir + lightboxItems.length) % lightboxItems.length;
    renderLightboxItem();
  }, 150);
}

/**
 * Alterna favorito persistido
 */
export function toggleFav(btn) {
  const item = lightboxItems[curIdx];
  if (!item) return;

  const favorites = getFavorites();
  const index = favorites.findIndex(p => p.src === item.src);
  
  let isFavNow = false;
  if (index > -1) {
    // Remove do localStorage
    favorites.splice(index, 1);
  } else {
    // Adiciona ao localStorage
    const photoToSave = {
      id: item.id || crypto.randomUUID(),
      src: item.src,
      thumbnail_src: item.thumbnail_src || item.src,
      original_src: item.original_src || item.src,
      name: item.name || item.title || '',
      w: item.w || null,
      h: item.h || null,
      album_id: item.albumId || item.album_id || null,
      sort_order: item.sort_order || 0
    };
    favorites.push(photoToSave);
    isFavNow = true;
  }

  saveFavorites(favorites);

  // Atualizar UI do botão
  btn.classList.toggle('active', isFavNow);
  btn.textContent = isFavNow ? '♥ Favoritado' : '♡ Favoritar';

  // Se o álbum atual for o virtual de favoritos, atualiza a galeria em background
  if (activeAlbumId === 'favorites-virtual-album') {
    renderAlbums();
  }
}
