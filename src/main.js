import './style.css';
import { initGallery, carregarAlbums, loadSharedAlbum } from './gallery';
import { testSupabaseConnection } from './supabase';

/**
 * Roteador de rotas limpas do lado do cliente (SPA History Router)
 */
function router() {
  const path = window.location.pathname;
  const match = path.match(/\/album\/([a-zA-Z0-9_-]+)/);

  if (match && match[1]) {
    const slug = match[1];
    loadSharedAlbum(slug);
  } else {
    // Restaura layout público da galeria e exibe todos os álbuns
    const albumTabs = document.getElementById('albumTabs');
    if (albumTabs) {
      albumTabs.style.display = 'grid';
    }
    carregarAlbums();
  }
}

// Registrar navegação por botões popstate
window.addEventListener('popstate', router);

/**
 * Escuta o estado da rede para exibir aviso offline em tempo real
 */
function updateNetworkStatus() {
  const banner = document.getElementById('offlineBanner');
  if (!banner) return;

  if (navigator.onLine) {
    banner.style.display = 'none';
  } else {
    banner.style.display = 'block';
  }
}

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);

/**
 * Inicializa a navegação e o menu mobile responsive
 */
function initNavigation() {
  const nav = document.getElementById('nav');
  const hamburger = document.getElementById('hamburger');
  const mobMenu = document.getElementById('mobMenu');

  // Cabeçalho sólido no scroll
  window.addEventListener('scroll', () => {
    if (nav) {
      nav.classList.toggle('solid', window.scrollY > 50);
    }
  });

  // Toggle do menu
  hamburger?.addEventListener('click', () => {
    const isOpen = mobMenu?.classList.toggle('open');
    hamburger.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });

  // Fechar menu mobile ao clicar nos links
  document.querySelectorAll('.mob-menu a, .mob-link').forEach(link => {
    link.addEventListener('click', () => {
      mobMenu?.classList.remove('open');
      hamburger?.classList.remove('open');
      hamburger?.setAttribute('aria-expanded', 'false');
    });
  });

  // Redimensionamento fecha o menu
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      mobMenu?.classList.remove('open');
      hamburger?.classList.remove('open');
      hamburger?.setAttribute('aria-expanded', 'false');
    }
  });

  // Logo recarrega para a home pública
  document.getElementById('logoLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.history.pushState({}, '', '/');
    router();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/**
 * Inicialização Geral do Site ao carregar a DOM
 */
document.addEventListener('DOMContentLoaded', () => {
  // Inicializa Módulos
  initNavigation();
  initGallery();

  // Executa Roteamento e Rede
  router();
  updateNetworkStatus();

  // Executa testes de conexão com Supabase no console
  testSupabaseConnection();

  // Revelação de seções suave (Intersection Observer)
  const revElements = document.querySelectorAll('.rev');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  revElements.forEach(el => observer.observe(el));

  // Animação inicial de viewfinder no hero
  setTimeout(() => {
    document.getElementById('viewfinder')?.classList.add('active');
  }, 100);
});
