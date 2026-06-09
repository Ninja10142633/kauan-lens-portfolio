import { supabase, signIn, signOut, getSession } from './supabase';
import { generateImageTiers, slugify, escapeHtml, formatDate } from './utils';
import { carregarAlbums, albums } from './gallery';

// Fila local de uploads
let pendingPhotos = [];
let isEditing = false;
let currentEditingAlbumId = null;

// Elementos da DOM
let ownerLocked, ownerTools, successMsg, loginErrorMsg;
let evTitle, evCat, evDate, evLocal, evNota, evStatus, evFeatured, albumFiles, pendingList;
let uploadQueueContainer, uploadQueueList, saveAlbumBtn;
let metricAlbums, metricPhotos, metricTrash;

/**
 * Inicializa a Área Administrativa e liga os eventos da DOM
 */
export async function initAdmin() {
  ownerLocked = document.getElementById('ownerLocked');
  ownerTools = document.getElementById('ownerTools');
  successMsg = document.getElementById('successMsg');
  loginErrorMsg = document.getElementById('loginErrorMsg');
  
  evTitle = document.getElementById('evTitle');
  evCat = document.getElementById('evCat');
  evDate = document.getElementById('evDate');
  evLocal = document.getElementById('evLocal');
  evNota = document.getElementById('evNota');
  evStatus = document.getElementById('evStatus');
  evFeatured = document.getElementById('evFeatured');
  albumFiles = document.getElementById('albumFiles');
  pendingList = document.getElementById('pendingList');
  
  uploadQueueContainer = document.getElementById('uploadQueueContainer');
  uploadQueueList = document.getElementById('uploadQueueList');
  saveAlbumBtn = document.getElementById('saveAlbumBtn');

  metricAlbums = document.getElementById('metricAlbums');
  metricPhotos = document.getElementById('metricPhotos');
  metricTrash = document.getElementById('metricTrash');

  // Registrar eventos de botões
  document.getElementById('loginBtn')?.addEventListener('click', handleLogin);
  document.getElementById('logoutBtn')?.addEventListener('click', handleLogout);
  document.getElementById('saveAlbumBtn')?.addEventListener('click', salvarAlbum);
  document.getElementById('clearFormBtn')?.addEventListener('click', limparFormulario);
  document.getElementById('exportBackupBtn')?.addEventListener('click', exportarBackup);

  // Selecionar arquivos
  albumFiles?.addEventListener('change', handleFilesSelection);

  // Tabs do Dashboard
  setupDashboardTabs();

  // Verificar se existe uma sessão ativa
  const session = await getSession();
  await atualizarInterfaceAdmin(session);
}

/**
 * Configura a alternância de telas (Tabs) no painel
 */
function setupDashboardTabs() {
  const tabNewAlbum = document.getElementById('tabNewAlbum');
  const tabManageAlbums = document.getElementById('tabManageAlbums');
  const tabTrash = document.getElementById('tabTrash');
  const tabLogs = document.getElementById('tabLogs');
  const tabBackup = document.getElementById('tabBackup');

  const contentAlbumForm = document.getElementById('contentAlbumForm');
  const contentManageAlbums = document.getElementById('contentManageAlbums');
  const contentTrash = document.getElementById('contentTrash');
  const contentLogs = document.getElementById('contentLogs');
  const contentBackup = document.getElementById('contentBackup');

  const tabs = [tabNewAlbum, tabManageAlbums, tabTrash, tabLogs, tabBackup];
  const contents = [contentAlbumForm, contentManageAlbums, contentTrash, contentLogs, contentBackup];

  tabs.forEach((tab, index) => {
    tab?.addEventListener('click', () => {
      tabs.forEach(t => t?.classList.remove('gold'));
      tab?.classList.add('gold');

      contents.forEach(c => c?.classList.add('hidden'));
      contents[index]?.classList.remove('hidden');

      if (tab === tabManageAlbums) carregarGerenciadorAlbuns();
      if (tab === tabTrash) carregarLixeira();
      if (tab === tabLogs) carregarLogs();
      if (tab === tabNewAlbum && !isEditing) limparFormulario();
    });
  });
}

/**
 * Atualiza a visibilidade do painel administrativo com base na sessão
 */
async function atualizarInterfaceAdmin(session) {
  const isOwner = !!session;
  
  if (isOwner) {
    const authorizedEmail = import.meta.env.VITE_AUTHORIZED_EMAIL || 'kauan@exemplo.com';
    const userEmail = session.user?.email;
    
    if (userEmail !== authorizedEmail) {
      try {
        await signOut();
      } catch (err) {
        console.error('Erro ao fazer signout de usuario nao autorizado:', err);
      }
      
      if (loginErrorMsg) {
        loginErrorMsg.textContent = 'Acesso Negado: E-mail não autorizado.';
        loginErrorMsg.style.display = 'block';
      }
      
      ownerLocked?.classList.remove('hidden');
      ownerTools?.classList.add('hidden');
      
      document.querySelectorAll('.admin-only').forEach(el => {
        el.classList.remove('visible');
      });
      return;
    }

    if (loginErrorMsg) {
      loginErrorMsg.style.display = 'none';
      loginErrorMsg.textContent = '';
    }
    ownerLocked?.classList.add('hidden');
    ownerTools?.classList.remove('hidden');
    
    // CARREGAMENTO DE DADOS - Apenas após autorização confirmada
    carregarMetricas();
    // Se o tab atual selecionado for o de Gerenciar Albuns, recarrega-o
    const tabManageAlbums = document.getElementById('tabManageAlbums');
    if (tabManageAlbums && tabManageAlbums.classList.contains('gold')) {
      carregarGerenciadorAlbuns();
    }
  } else {
    ownerLocked?.classList.remove('hidden');
    ownerTools?.classList.add('hidden');
  }

  // Atualizar visibilidade de elementos administrativos na página principal (caso existam)
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('visible', isOwner);
  });
}

/**
 * Escreve um log de auditoria estruturado em JSON no Supabase
 */
async function registrarLog(action, extraData = {}) {
  if (!supabase) return;
  try {
    const session = await getSession();
    const admin_email = session?.user?.email || 'desconhecido';
    
    const logDetails = {
      action: action,
      album_id: extraData.album_id || null,
      photo_id: extraData.photo_id || null,
      admin_email: admin_email,
      timestamp: new Date().toISOString(),
      details: extraData.details || null
    };

    await supabase.from('admin_logs').insert({ 
      action, 
      details: JSON.stringify(logDetails) 
    });
  } catch (err) {
    console.error('Falha ao escrever log estruturado no banco:', err);
  }
}

/**
 * Fluxo de Login
 */
async function handleLogin() {
  const email = document.getElementById('ownerEmail').value.trim();
  const password = document.getElementById('ownerPass').value;

  if (!email || !password) {
    alert('Preencha seu email e senha de acesso.');
    return;
  }

  const authorizedEmail = import.meta.env.VITE_AUTHORIZED_EMAIL || 'kauan@exemplo.com';
  if (email !== authorizedEmail) {
    if (loginErrorMsg) {
      loginErrorMsg.textContent = 'Acesso Negado: E-mail não autorizado.';
      loginErrorMsg.style.display = 'block';
    }
    return;
  }

  if (loginErrorMsg) {
    loginErrorMsg.style.display = 'none';
    loginErrorMsg.textContent = '';
  }

  try {
    const data = await signIn(email, password);
    // Grava log
    await registrarLog('login', { details: `E-mail logado: ${email}` });
    await atualizarInterfaceAdmin(data.session);
    alert('Acesso autorizado com sucesso!');
  } catch (err) {
    console.error(err);
    if (loginErrorMsg) {
      loginErrorMsg.textContent = 'Erro de login: ' + err.message;
      loginErrorMsg.style.display = 'block';
    } else {
      alert('Erro de login: ' + err.message);
    }
  }
}

/**
 * Fluxo de Logout
 */
async function handleLogout() {
  try {
    await registrarLog('logout');
    await signOut();
    alert('Sessão encerrada.');
    await atualizarInterfaceAdmin(null);
  } catch (err) {
    console.error(err);
  }
}

/**
 * Carrega e exibe as métricas de totalizadores no Dashboard
 */
async function carregarMetricas() {
  if (!supabase || !metricAlbums || !metricPhotos || !metricTrash) return;

  try {
    // 1. Total de álbuns ativos
    const { count: countAlbums } = await supabase
      .from('albums')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    // 2. Total de fotos ativas (não deletadas de álbuns não deletados)
    const { count: countPhotos } = await supabase
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    // 3. Total de itens na lixeira (álbuns ou fotos deletadas)
    const { count: countAlbumsTrash } = await supabase
      .from('albums')
      .select('*', { count: 'exact', head: true })
      .not('deleted_at', 'is', null);

    const { count: countPhotosTrash } = await supabase
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .not('deleted_at', 'is', null);

    metricAlbums.textContent = countAlbums || 0;
    metricPhotos.textContent = countPhotos || 0;
    metricTrash.textContent = (countAlbumsTrash || 0) + (countPhotosTrash || 0);
  } catch (err) {
    console.error('Falha ao carregar métricas:', err);
  }
}

/**
 * Carrega a lista de todos os álbuns ativos para edição e reordenação
 */
async function carregarGerenciadorAlbuns() {
  const manageList = document.getElementById('manageAlbumsList');
  if (!supabase || !manageList) return;

  try {
    const { data: dbAlbums, error } = await supabase
      .from('albums')
      .select('*, photos(*)')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    if (!dbAlbums || !dbAlbums.length) {
      manageList.innerHTML = '<p class="text-dim" style="font-size:0.8rem; padding:1rem 0;">Nenhum álbum cadastrado.</p>';
      return;
    }

    manageList.innerHTML = dbAlbums.map((album, index) => {
      // Filtrar fotos que não foram soft-deletadas
      const activePhotos = (album.photos || []).filter(p => !p.deleted_at);
      const isDraft = album.status === 'draft';
      const isFeatured = album.is_featured;
      const cover = album.cover_url || (activePhotos[0] ? activePhotos[0].thumbnail_src || activePhotos[0].src : '');

      return `
        <div class="trash-item" style="border: 1px solid rgba(255,255,255,0.05); padding: 1.2rem; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; background: rgba(255,255,255,0.01);">
          <div style="display: flex; gap: 1.2rem; align-items: center; min-width: 0; flex: 1;">
            ${cover ? `<img src="${cover}" style="width: 55px; height: 55px; object-fit: cover; border-radius: 3px; border: 1px solid var(--border); flex-shrink: 0;" />` : `<div style="width: 55px; height: 55px; background: var(--bg-sec); display: flex; align-items: center; justify-content: center; font-size: 0.65rem; color: var(--text-dim); border: 1px solid var(--border); flex-shrink: 0;">SEM CAPA</div>`}
            <div style="min-width: 0;">
              <span class="trash-title" style="font-weight: 500; font-size: 1rem; display: block; margin-bottom: 0.3rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${escapeHtml(album.title)} 
                ${isDraft ? `<span style="font-size: 0.65rem; background: rgba(212,178,122,0.15); color: var(--gold); padding: 0.1rem 0.5rem; border-radius: 2px; margin-left: 0.5rem; font-weight: normal; text-transform: uppercase; letter-spacing:0.05em;">Rascunho</span>` : `<span style="font-size: 0.65rem; background: rgba(0,255,0,0.1); color: #00ff00; padding: 0.1rem 0.5rem; border-radius: 2px; margin-left: 0.5rem; font-weight: normal; text-transform: uppercase; letter-spacing:0.05em;">Publicado</span>`}
                ${isFeatured ? `<span style="font-size: 0.65rem; background: rgba(255,215,0,0.1); color: #ffd700; padding: 0.1rem 0.5rem; border-radius: 2px; margin-left: 0.3rem; font-weight: normal;">★ Destaque</span>` : ''}
              </span>
              <p class="trash-meta" style="margin: 0; font-size: 0.75rem;">
                Data: ${escapeHtml(formatDate(album.date))} · Categoria: ${escapeHtml(album.cat || 'registro')} · Local: ${escapeHtml(album.local || 'LEM, Bahia')}
                <br/>
                Fotos Ativas: <strong>${activePhotos.length}</strong>
              </p>
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-shrink: 0;">
            <!-- Controles de Reordenação -->
            <button class="editor-photo-btn" onclick="window.reordenarAlbum('${album.id}', -1)" title="Mover para cima" ${index === 0 ? 'disabled' : ''}>↑</button>
            <button class="editor-photo-btn" onclick="window.reordenarAlbum('${album.id}', 1)" title="Mover para baixo" ${index === dbAlbums.length - 1 ? 'disabled' : ''}>↓</button>
            
            <button class="mini-btn gold" onclick="window.iniciarEdicaoAlbum('${album.id}')" style="min-height: 36px; padding: 0 1rem; margin-left: 0.5rem;">Editar</button>
            <button class="mini-btn danger" onclick="window.deletarAlbumMapeado('${album.id}')" style="min-height: 36px; padding: 0 1rem; border-color: #ff5555; color: #ff5555;">Deletar</button>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Erro ao renderizar gerenciador de álbuns:', err);
    manageList.innerHTML = '<p class="text-dim" style="font-size:0.8rem;">Falha ao obter dados.</p>';
  }
}
window.carregarGerenciadorAlbuns = carregarGerenciadorAlbuns;

/**
 * Deleta album de forma lógica (Soft Delete)
 */
async function deletarAlbumMapeado(albumId) {
  if (!supabase) return;
  if (!confirm('Deseja mover este álbum para a lixeira?')) return;

  try {
    const { error } = await supabase
      .from('albums')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', albumId);

    if (error) throw error;

    await registrarLog('soft_delete_album', { album_id: albumId });
    alert('Álbum enviado para a lixeira!');
    carregarGerenciadorAlbuns();
    carregarMetricas();
  } catch (err) {
    alert('Erro ao excluir álbum: ' + err.message);
  }
}
window.deletarAlbumMapeado = deletarAlbumMapeado;

/**
 * Reordena albums logicamente
 */
async function reordenarAlbum(albumId, direction) {
  if (!supabase) return;

  try {
    const { data: dbAlbums, error } = await supabase
      .from('albums')
      .select('id, sort_order')
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    const albumIdx = dbAlbums.findIndex(a => a.id === albumId);
    if (albumIdx === -1) return;

    const targetIdx = albumIdx + direction;
    if (targetIdx < 0 || targetIdx >= dbAlbums.length) return;

    const currentAlb = dbAlbums[albumIdx];
    const targetAlb = dbAlbums[targetIdx];

    // Swap sort order
    const orderCurrent = currentAlb.sort_order;
    const orderTarget = targetAlb.sort_order;

    const { error: err1 } = await supabase.from('albums').update({ sort_order: orderTarget }).eq('id', currentAlb.id);
    const { error: err2 } = await supabase.from('albums').update({ sort_order: orderCurrent }).eq('id', targetAlb.id);

    if (err1 || err2) throw err1 || err2;

    await registrarLog('reorder_albums', { details: `Álbum reordenado: ${albumId} com a posição de ${targetAlb.id}` });
    carregarGerenciadorAlbuns();
  } catch (err) {
    console.error('Erro na reordenação de álbuns:', err);
  }
}
window.reordenarAlbum = reordenarAlbum;

/**
 * Carrega a Lixeira (Soft Deleted items)
 */
async function carregarLixeira() {
  const trashList = document.getElementById('trashList');
  if (!supabase || !trashList) return;

  try {
    // 1. Álbuns Deletados
    const { data: deletedAlbums, error: errAlb } = await supabase
      .from('albums')
      .select('*, photos(*)')
      .not('deleted_at', 'is', null);

    // 2. Fotos Deletadas (de álbuns que NÃO estão deletados)
    const { data: deletedPhotos, error: errPhot } = await supabase
      .from('photos')
      .select('*, albums(*)')
      .not('deleted_at', 'is', null);

    if (errAlb || errPhot) throw errAlb || errPhot;

    const hasAlbums = deletedAlbums && deletedAlbums.length;
    const hasPhotos = deletedPhotos && deletedPhotos.length;

    if (!hasAlbums && !hasPhotos) {
      trashList.innerHTML = '<p class="text-dim" style="font-size:0.8rem; padding: 1rem 0;">A lixeira está vazia.</p>';
      return;
    }

    let html = '';

    if (hasAlbums) {
      html += `<h4 class="form-label" style="color:var(--gold); margin-bottom:1rem;">Álbuns na Lixeira</h4>`;
      html += deletedAlbums.map(album => `
        <div class="trash-item" style="border: 1px solid rgba(255,255,255,0.05); padding: 1rem; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem; background: rgba(255,0,0,0.02);">
          <div>
            <span class="trash-title" style="font-weight:500;">${escapeHtml(album.title)} [ÁLBUM]</span>
            <p class="trash-meta" style="margin:0.2rem 0 0; font-size:0.7rem;">
              Fotos: ${album.photos ? album.photos.length : 0} · Deletado em: ${escapeHtml(new Date(album.deleted_at).toLocaleString('pt-BR'))}
            </p>
          </div>
          <div style="display:flex; gap:0.5rem;">
            <button class="mini-btn gold" onclick="window.restaurarAlbum('${album.id}')" style="min-height:36px; padding:0 0.8rem;">Restaurar</button>
            <button class="mini-btn danger" onclick="window.expurgarAlbum('${album.id}')" style="min-height:36px; padding:0 0.8rem; border-color:#ff5555; color:#ff5555;">Excluir Permanente</button>
          </div>
        </div>
      `).join('');
    }

    if (hasPhotos) {
      html += `<h4 class="form-label" style="color:var(--gold); margin-top:2rem; margin-bottom:1rem;">Fotos na Lixeira</h4>`;
      html += deletedPhotos.map(photo => `
        <div class="trash-item" style="border: 1px solid rgba(255,255,255,0.05); padding: 1rem; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem; background: rgba(255,0,0,0.02);">
          <div style="display:flex; gap:1rem; align-items:center;">
            <img src="${photo.thumbnail_src || photo.src}" style="width: 40px; height: 40px; object-fit:cover; border-radius:2px;" />
            <div>
              <span class="trash-title" style="font-weight:500;">${escapeHtml(photo.name || 'Foto sem nome')}</span>
              <p class="trash-meta" style="margin:0.2rem 0 0; font-size:0.7rem;">
                Álbum: ${escapeHtml(photo.albums ? photo.albums.title : 'Desconhecido')} · Deletada em: ${escapeHtml(new Date(photo.deleted_at).toLocaleString('pt-BR'))}
              </p>
            </div>
          </div>
          <div style="display:flex; gap:0.5rem;">
            <button class="mini-btn gold" onclick="window.restaurarFotoMapeada('${photo.id}')" style="min-height:36px; padding:0 0.8rem;">Restaurar</button>
            <button class="mini-btn danger" onclick="window.expurgarFotoMapeada('${photo.id}')" style="min-height:36px; padding:0 0.8rem; border-color:#ff5555; color:#ff5555;">Excluir Permanente</button>
          </div>
        </div>
      `).join('');
    }

    trashList.innerHTML = html;

  } catch (err) {
    console.error('Erro ao carregar lixeira:', err);
    trashList.innerHTML = '<p class="text-dim" style="font-size:0.8rem;">Erro ao carregar lixeira.</p>';
  }
}

/**
 * Restaura um álbum da Lixeira (limpa deleted_at)
 */
async function restaurarAlbum(id) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('albums')
      .update({ deleted_at: null })
      .eq('id', id);

    if (error) throw error;

    alert('Álbum restaurado com sucesso!');
    await registrarLog('restore_album', { album_id: id });
    carregarLixeira();
    carregarMetricas();
  } catch (err) {
    alert('Erro ao restaurar: ' + err.message);
  }
}
window.restaurarAlbum = restaurarAlbum;

/**
 * Restaura uma foto da Lixeira (limpa deleted_at)
 */
async function restaurarFotoMapeada(id) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('photos')
      .update({ deleted_at: null })
      .eq('id', id);

    if (error) throw error;

    alert('Foto restaurada com sucesso!');
    await registrarLog('restore_photo', { photo_id: id });
    carregarLixeira();
    carregarMetricas();
  } catch (err) {
    alert('Erro ao restaurar foto: ' + err.message);
  }
}
window.restaurarFotoMapeada = restaurarFotoMapeada;

/**
 * Exclui permanentemente o álbum e suas imagens (Purge físico)
 */
async function expurgarAlbum(id) {
  if (!supabase) return;
  if (!confirm('Esta ação removerá permanentemente o álbum e todas as suas imagens físicas do Storage. Esta ação não poderá ser desfeita. Deseja continuar?')) return;

  try {
    // 1. Buscar fotos vinculadas a este álbum para obter os caminhos do Storage
    const { data: photos, error: selectError } = await supabase
      .from('photos')
      .select('src, thumbnail_src, original_src')
      .eq('album_id', id);

    if (selectError) throw selectError;

    // 2. Extrair caminhos dos arquivos do storage e remover
    if (photos && photos.length) {
      const pathsToDelete = [];
      photos.forEach(p => {
        const matchSrc = p.src.match(/\/photos\/(.+)$/);
        const matchThumb = p.thumbnail_src.match(/\/photos\/(.+)$/);
        const matchOrig = p.original_src.match(/\/photos\/(.+)$/);

        if (matchSrc) pathsToDelete.push(decodeURIComponent(matchSrc[1]));
        if (matchThumb) pathsToDelete.push(decodeURIComponent(matchThumb[1]));
        if (matchOrig) pathsToDelete.push(decodeURIComponent(matchOrig[1]));
      });

      if (pathsToDelete.length) {
        const { error: storageError } = await supabase.storage
          .from('photos')
          .remove(pathsToDelete);
        if (storageError) console.warn('Aviso ao deletar arquivos físicos:', storageError);
      }
    }

    // 3. Excluir álbum no banco (Postgres cascade deleta as linhas da tabela photos)
    const { error: deleteError } = await supabase
      .from('albums')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    alert('Álbum excluído permanentemente!');
    await registrarLog('permanent_delete_album', { 
      album_id: id,
      details: `Quantidade de fotos excluídas: ${photos ? photos.length : 0}`
    });
    carregarLixeira();
    carregarMetricas();
  } catch (err) {
    alert('Erro ao expurgar: ' + err.message);
  }
}
window.expurgarAlbum = expurgarAlbum;

/**
 * Exclui permanentemente uma foto individual
 */
async function expurgarFotoMapeada(photoId) {
  if (!supabase) return;
  if (!confirm('Deseja excluir permanentemente o arquivo desta foto do Storage? Esta ação não poderá ser desfeita. Deseja continuar?')) return;

  try {
    const { data: photo, error: selectError } = await supabase
      .from('photos')
      .select('album_id, src, thumbnail_src, original_src, name')
      .eq('id', photoId)
      .single();

    if (selectError) throw selectError;

    if (photo) {
      const filesToRemove = [];
      const matchSrc = photo.src.match(/\/photos\/(.+)$/);
      const matchThumb = photo.thumbnail_src.match(/\/photos\/(.+)$/);
      const matchOrig = photo.original_src.match(/\/photos\/(.+)$/);

      if (matchSrc) filesToRemove.push(decodeURIComponent(matchSrc[1]));
      if (matchThumb) filesToRemove.push(decodeURIComponent(matchThumb[1]));
      if (matchOrig) filesToRemove.push(decodeURIComponent(matchOrig[1]));

      if (filesToRemove.length) {
        await supabase.storage.from('photos').remove(filesToRemove);
      }

      // Deleta do banco
      const { error: dbError } = await supabase
        .from('photos')
        .delete()
        .eq('id', photoId);

      if (dbError) throw dbError;

      alert('Foto excluída permanentemente do Storage e Banco!');
      await registrarLog('permanent_delete_photo', {
        album_id: photo.album_id,
        photo_id: photoId,
        details: { filename: photo.name || 'desconhecido' }
      });
      carregarLixeira();
      carregarMetricas();
    }
  } catch (err) {
    alert('Erro ao expurgar foto: ' + err.message);
  }
}
window.expurgarFotoMapeada = expurgarFotoMapeada;

/**
 * Carrega a lista de logs administrativos estruturados em JSON
 */
async function carregarLogs() {
  const logsList = document.getElementById('logsList');
  if (!supabase || !logsList) return;

  try {
    const { data: logs, error } = await supabase
      .from('admin_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    if (!logs || !logs.length) {
      logsList.innerHTML = '<p class="text-dim" style="font-size:0.8rem; padding: 1rem;">Nenhum log registrado.</p>';
      return;
    }

    logsList.innerHTML = logs.map(log => {
      let dispDetails = '';
      let emailSuffix = '';
      try {
        const parsed = JSON.parse(log.details);
        if (parsed.admin_email) {
          emailSuffix = ` por ${parsed.admin_email}`;
        }
        if (parsed.details) {
          dispDetails = typeof parsed.details === 'object' ? JSON.stringify(parsed.details) : parsed.details;
        }
        // Adiciona contexto do álbum/foto se houver
        const contexts = [];
        if (parsed.album_id) contexts.push(`Álbum: ${parsed.album_id}`);
        if (parsed.photo_id) contexts.push(`Foto: ${parsed.photo_id}`);
        if (contexts.length) {
          dispDetails = `${contexts.join(' · ')} ${dispDetails ? `| ${dispDetails}` : ''}`;
        }
      } catch (e) {
        dispDetails = log.details || '';
      }

      return `
        <div class="log-item">
          <span class="log-details"><strong>[${escapeHtml(log.action.toUpperCase())}]</strong> ${escapeHtml(dispDetails)}${escapeHtml(emailSuffix)}</span>
          <span class="log-date">${escapeHtml(new Date(log.created_at).toLocaleString('pt-BR'))}</span>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Erro ao carregar logs:', err);
    logsList.innerHTML = '<p class="text-dim" style="font-size:0.8rem; padding: 1rem;">Erro ao carregar logs.</p>';
  }
}

/**
 * Exporta todos os dados em JSON (Albums, Photos com descriptions/slugs, Logs) para portabilidade
 */
async function exportarBackup() {
  if (!supabase) return;
  try {
    const { data: dbAlbums, error: errorAlbums } = await supabase.from('albums').select('*');
    const { data: dbPhotos, error: errorPhotos } = await supabase.from('photos').select('*');
    const { data: dbLogs, error: errorLogs } = await supabase.from('admin_logs').select('*');
    
    if (errorAlbums || errorPhotos || errorLogs) throw errorAlbums || errorPhotos || errorLogs;

    // Tenta obter favoritos locais
    let favorites = [];
    try {
      favorites = JSON.parse(localStorage.getItem('kauanLensFavorites') || '[]');
    } catch (e) {}

    const backupData = {
      timestamp: new Date().toISOString(),
      provider: 'Supabase / Kauan Portfolio Cloud Relational',
      albums: dbAlbums || [],
      photos: dbPhotos || [],
      admin_logs: dbLogs || [],
      local_favorites: favorites
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_lensbyzy_portavel_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    await registrarLog('backup_exported', { details: `Exportados ${backupData.albums.length} albuns e ${backupData.photos.length} fotos.` });
    alert('Exportação JSON de portabilidade concluída com sucesso!');
  } catch (err) {
    alert('Erro ao exportar backup: ' + err.message);
  }
}

/**
 * Gerencia a seleção de múltiplos arquivos e gera os previews na fila
 */
async function handleFilesSelection(e) {
  const files = [...e.target.files];
  if (!files.length) return;

  const uploadArea = document.getElementById('uploadArea');
  const originalText = uploadArea.querySelector('.upload-btn-lbl').textContent;
  uploadArea.querySelector('.upload-btn-lbl').textContent = 'Processando imagens...';

  try {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      
      const tiers = await generateImageTiers(file);
      pendingPhotos.push(tiers);
    }

    renderFilaUpload();
  } catch (err) {
    console.error(err);
    alert('Erro ao processar as fotos selecionadas.');
  } finally {
    uploadArea.querySelector('.upload-btn-lbl').textContent = originalText;
    e.target.value = ''; // Reset input
  }
}

/**
 * Renderiza a fila visual de uploads com previews e botões de remoção
 */
function renderFilaUpload() {
  if (!pendingPhotos.length) {
    uploadQueueContainer?.classList.add('hidden');
    uploadQueueList.innerHTML = '';
    return;
  }

  uploadQueueContainer?.classList.remove('hidden');
  uploadQueueList.innerHTML = pendingPhotos.map((photo, index) => `
    <div class="upload-queue-item" id="queueItem_${index}">
      <img src="${photo.thumbnail.src}" class="upload-queue-thumb" alt="Preview">
      <div class="upload-queue-info">
        <span class="upload-queue-name">${escapeHtml(photo.name)}</span>
        <div class="upload-queue-progress-bar">
          <div class="upload-queue-progress-fill" id="progressFill_${index}"></div>
        </div>
      </div>
      <button class="upload-queue-remove" onclick="window.removerFilaUpload(${index})">Remover</button>
    </div>
  `).join('');
}

/**
 * Remove um item específico da fila de uploads antes de enviar
 */
export function removerFilaUpload(index) {
  pendingPhotos.splice(index, 1);
  renderFilaUpload();
}
window.removerFilaUpload = removerFilaUpload;

/**
 * Auxiliar para subir arquivos no Supabase Storage
 */
async function uploadTierToStorage(dataUri, path, contentType) {
  const parts = dataUri.split(';base64,');
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  const blob = new Blob([uInt8Array], { type: contentType });

  const { data, error } = await supabase.storage
    .from('photos')
    .upload(path, blob, {
      contentType: contentType,
      cacheControl: '31536000',
      upsert: true
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('photos')
    .getPublicUrl(path);

  return publicUrl;
}

/**
 * Cria ou edita um álbum no Supabase
 */
async function salvarAlbum() {
  const title = evTitle.value.trim();
  const date = evDate.value || new Date().toISOString().split('T')[0];
  const local = evLocal.value.trim() || 'LEM, Bahia';
  const cat = evCat.value;
  const note = evNota.value.trim();
  const status = evStatus.value;
  const isFeatured = evFeatured.checked;

  if (!title) {
    evTitle.focus();
    alert('O título do álbum é obrigatório.');
    return;
  }

  if (!isEditing && !pendingPhotos.length) {
    alert('Adicione pelo menos uma imagem na fila para publicar o álbum.');
    return;
  }

  if (!supabase) {
    alert('Operação indisponível no modo offline (Supabase não conectado).');
    return;
  }

  if (successMsg) {
    successMsg.style.display = 'block';
    successMsg.textContent = 'Aguarde, processando transação no banco...';
  }

  saveAlbumBtn.disabled = true;

  try {
    const slug = slugify(title);
    let albumId = currentEditingAlbumId;

    // 1. Inserir ou atualizar cabeçalho do Álbum
    if (isEditing) {
      const { error } = await supabase
        .from('albums')
        .update({ title, slug, date, local, cat, note, status, is_featured: isFeatured })
        .eq('id', albumId);

      if (error) throw error;
      await registrarLog('edit_album', { album_id: albumId, details: `Campos do álbum atualizados.` });
    } else {
      // Busca maior sort_order
      const { data: lastAlbums } = await supabase
        .from('albums')
        .select('sort_order')
        .is('deleted_at', null)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextOrder = lastAlbums && lastAlbums.length ? lastAlbums[0].sort_order + 1 : 1;

      const { data: newAlbum, error } = await supabase
        .from('albums')
        .insert({ title, slug, date, local, cat, note, status, sort_order: nextOrder, is_featured: isFeatured })
        .select()
        .single();

      if (error) throw error;
      albumId = newAlbum.id;
      await registrarLog('create_album', { album_id: albumId });
    }

    // 2. Upload e salvamento de novas fotos
    if (pendingPhotos.length) {
      // Busca a maior ordenação
      const { data: lastPhotos } = await supabase
        .from('photos')
        .select('sort_order')
        .eq('album_id', albumId)
        .order('sort_order', { ascending: false })
        .limit(1);

      let startOrder = lastPhotos && lastPhotos.length ? lastPhotos[0].sort_order + 1 : 1;

      for (let i = 0; i < pendingPhotos.length; i++) {
        const photo = pendingPhotos[i];
        
        const progressFill = document.getElementById(`progressFill_${i}`);
        if (progressFill) progressFill.style.width = '20%';

        const cleanPhotoName = slugify(photo.name);
        const uuidName = crypto.randomUUID();

        // Gerar SLUG permanente e único por foto
        const photoSlug = `${slug}-${cleanPhotoName || 'foto'}-${uuidName.substring(0, 8)}`;

        const pathOriginal = `albums/${slug}/original/${uuidName}_${cleanPhotoName}.jpg`;
        const pathOptimized = `albums/${slug}/optimized/${uuidName}_${cleanPhotoName}.jpg`;
        const pathThumbnail = `albums/${slug}/thumbnail/${uuidName}_${cleanPhotoName}.jpg`;

        if (progressFill) progressFill.style.width = '40%';

        const urlOriginal = await uploadTierToStorage(photo.original.src, pathOriginal, 'image/jpeg');
        if (progressFill) progressFill.style.width = '60%';

        const urlOptimized = await uploadTierToStorage(photo.optimized.src, pathOptimized, 'image/jpeg');
        if (progressFill) progressFill.style.width = '80%';

        const urlThumbnail = await uploadTierToStorage(photo.thumbnail.src, pathThumbnail, 'image/jpeg');
        if (progressFill) progressFill.style.width = '100%';

        // Inserção no banco
        const { error: photoDbError } = await supabase
          .from('photos')
          .insert({
            album_id: albumId,
            src: urlOptimized,
            thumbnail_src: urlThumbnail,
            original_src: urlOriginal,
            name: photo.name,
            w: photo.w,
            h: photo.h,
            sort_order: startOrder + i,
            slug: photoSlug
          });

        if (photoDbError) throw photoDbError;
      }
      
      await registrarLog('upload_photos', { 
        album_id: albumId, 
        details: `Upload incremental de ${pendingPhotos.length} fotos.` 
      });
    }

    // Definir cover_url automática apenas se for nula
    const { data: coverCheck } = await supabase
      .from('albums')
      .select('cover_url')
      .eq('id', albumId)
      .single();

    if (coverCheck && !coverCheck.cover_url) {
      const { data: firstPhoto } = await supabase
        .from('photos')
        .select('src')
        .eq('album_id', albumId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
        .limit(1);

      if (firstPhoto && firstPhoto.length) {
        await supabase
          .from('albums')
          .update({ cover_url: firstPhoto[0].src })
          .eq('id', albumId);
      }
    }

    if (successMsg) {
      successMsg.textContent = isEditing ? 'Alterações salvas com sucesso!' : 'Álbum publicado com sucesso!';
      setTimeout(() => { successMsg.style.display = 'none'; }, 4000);
    }

    limparFormulario();
    carregarMetricas();
    await carregarAlbums();
    
    // Volta para o gerenciador de álbuns
    const tabManageAlbums = document.getElementById('tabManageAlbums');
    tabManageAlbums?.click();

  } catch (err) {
    console.error('Falha na transação:', err);
    alert('Erro ao publicar: ' + err.message);
    if (successMsg) successMsg.style.display = 'none';
  } finally {
    saveAlbumBtn.disabled = false;
  }
}

/**
 * Limpa o formulário administrativo
 */
function limparFormulario() {
  evTitle.value = '';
  evDate.value = '';
  evLocal.value = '';
  evNota.value = '';
  evStatus.value = 'draft';
  evFeatured.checked = false;
  
  pendingPhotos = [];
  isEditing = false;
  currentEditingAlbumId = null;

  document.getElementById('formAlbumTitle').textContent = 'Criar Novo Álbum';
  saveAlbumBtn.textContent = 'Publicar Álbum';
  
  document.getElementById('albumPhotosEditor')?.remove();
  renderFilaUpload();
}

/**
 * Ativa o modo de edição de um álbum existente
 */
export async function iniciarEdicaoAlbum(albumId) {
  // Query Supabase de forma isolada para carregar fotos mesmo que a galeria pública não as mostre
  if (!supabase) return;
  try {
    const { data: dbAlbums, error } = await supabase
      .from('albums')
      .select('*, photos(*)')
      .eq('id', albumId)
      .single();

    if (error) throw error;
    
    // Ativar aba Novo Álbum (que serve como form de edição)
    document.getElementById('tabNewAlbum')?.click();

    isEditing = true;
    currentEditingAlbumId = albumId;

    document.getElementById('formAlbumTitle').textContent = `Editar Álbum: ${dbAlbums.title}`;
    saveAlbumBtn.textContent = 'Salvar Alterações';

    evTitle.value = dbAlbums.title;
    evDate.value = dbAlbums.date;
    evLocal.value = dbAlbums.local || '';
    evNota.value = dbAlbums.note || '';
    evStatus.value = dbAlbums.status;
    evFeatured.checked = dbAlbums.is_featured || false;

    // Filtra fotos do editor removendo as soft-deletadas
    const activePhotos = (dbAlbums.photos || []).filter(p => !p.deleted_at);
    dbAlbums.photos = activePhotos.sort((a, b) => a.sort_order - b.sort_order);

    renderEditorFotosAlbum(dbAlbums);
  } catch (err) {
    console.error(err);
    alert('Erro ao carregar detalhes do álbum.');
  }
}
window.iniciarEdicaoAlbum = iniciarEdicaoAlbum;

/**
 * Renderiza o mini-painel de edição de fotos individuais com descrições e reordenação sequencial
 */
function renderEditorFotosAlbum(album) {
  const form = document.getElementById('contentAlbumForm');
  document.getElementById('albumPhotosEditor')?.remove();

  const editorDiv = document.createElement('div');
  editorDiv.id = 'albumPhotosEditor';
  editorDiv.className = 'album-photos-editor';
  
  editorDiv.innerHTML = `
    <h4 class="form-label" style="color:var(--gold); margin-top: 2rem;">Fotos Ativas (${album.photos.length})</h4>
    <p class="sec-sub" style="font-size:0.7rem; margin-bottom:1.2rem;">Configure a capa do álbum, adicione descrições (salvas automaticamente ao perder o foco) ou reordene as fotos de 1 a N.</p>
    <div class="editor-photos-grid" style="display:grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
      ${album.photos.map((photo, index) => {
        const isCover = album.cover_url === photo.src;
        return `
          <div class="editor-photo-card" id="photoCard_${photo.id}" style="border:1px solid rgba(255,255,255,0.05); padding:0.8rem; background:rgba(255,255,255,0.01); border-radius:3px; display:flex; flex-direction:column;">
            <img src="${photo.thumbnail_src || photo.src}" alt="Thumb" style="width:100%; height:120px; object-fit:cover; border-radius:2px; border:1px solid var(--border);">
            
            <!-- Descrição Opcional -->
            <input type="text" class="form-input" style="font-size:0.7rem; padding:0.4rem 0.6rem; margin-top:0.6rem; min-height:28px;" placeholder="Descrição..." id="desc_${photo.id}" value="${escapeHtml(photo.description || '')}" onchange="window.salvarDescricaoFoto('${album.id}', '${photo.id}', this.value)">
            
            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:0.6rem;">
              <span style="font-size:0.65rem; color:var(--text-dim);">Ordem: <strong>${photo.sort_order}</strong></span>
              <div style="display:flex; gap:0.25rem;">
                <button class="editor-photo-btn ${isCover ? 'active' : ''}" onclick="window.definirCapaAlbum('${album.id}', '${photo.src}')" title="Definir como Capa" style="padding:0.2rem 0.4rem; font-size:0.6rem;">
                  ⭐
                </button>
                <button class="editor-photo-btn" onclick="window.definirPrimeiraFoto('${album.id}', '${photo.id}')" title="Definir como primeira" style="padding:0.2rem 0.4rem; font-size:0.6rem; color:var(--gold);">
                  ⤒
                </button>
                <button class="editor-photo-btn" onclick="window.reordenarFoto('${album.id}', '${photo.id}', -1)" title="Mover para cima" ${index === 0 ? 'disabled' : ''} style="padding:0.2rem 0.4rem; font-size:0.6rem;">
                  ←
                </button>
                <button class="editor-photo-btn" onclick="window.reordenarFoto('${album.id}', '${photo.id}', 1)" title="Mover para baixo" ${index === album.photos.length - 1 ? 'disabled' : ''} style="padding:0.2rem 0.4rem; font-size:0.6rem;">
                  →
                </button>
                <button class="editor-photo-btn danger" onclick="window.excluirFotoAlbum('${album.id}', '${photo.id}')" title="Excluir Foto" style="padding:0.2rem 0.4rem; font-size:0.6rem; border-color:#ff5555; color:#ff5555;">
                  ✕
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  form.insertBefore(editorDiv, form.querySelector('.owner-actions'));
}

/**
 * Define imagem de capa de forma independente
 */
async function definirCapaAlbum(albumId, photoUrl) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('albums')
      .update({ cover_url: photoUrl })
      .eq('id', albumId);

    if (error) throw error;
    alert('Capa do álbum definida com sucesso!');
    await registrarLog('set_cover_album', { album_id: albumId, details: `Capa alterada.` });

    await carregarAlbums();
    recarregarEditorPeloId(albumId);
  } catch (err) {
    alert('Erro ao definir capa: ' + err.message);
  }
}
window.definirCapaAlbum = definirCapaAlbum;

/**
 * Salva a descrição da foto diretamente
 */
async function salvarDescricaoFoto(albumId, photoId, description) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('photos')
      .update({ description })
      .eq('id', photoId);

    if (error) throw error;
    console.log(`Descrição salva para a foto ${photoId}: ${description}`);
    await carregarAlbums();
  } catch (err) {
    alert('Erro ao salvar descrição: ' + err.message);
  }
}
window.salvarDescricaoFoto = salvarDescricaoFoto;

/**
 * Deleta foto de forma lógica (Soft Delete)
 */
async function excluirFotoAlbum(albumId, photoId) {
  if (!supabase) return;
  if (!confirm('Deseja mover esta foto para a lixeira? Ela será ocultada da galeria pública.')) return;

  try {
    const { error } = await supabase
      .from('photos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', photoId);

    if (error) throw error;

    alert('Foto movida para a lixeira!');
    await registrarLog('soft_delete_photo', { album_id: albumId, photo_id: photoId });
    
    await carregarAlbums();
    recarregarEditorPeloId(albumId);
    carregarMetricas();
  } catch (err) {
    alert('Erro ao excluir foto: ' + err.message);
  }
}
window.excluirFotoAlbum = excluirFotoAlbum;

/**
 * Reordena fotos aplicando reindexação sequencial 1, 2, 3, 4, 5 sem números negativos
 */
async function reordenarFoto(albumId, photoId, direction) {
  if (!supabase) return;
  try {
    // Busca fotos ativas ordenadas por sort_order
    const { data: dbPhotos, error } = await supabase
      .from('photos')
      .select('id, sort_order')
      .eq('album_id', albumId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    const photoIdx = dbPhotos.findIndex(p => p.id === photoId);
    if (photoIdx === -1) return;

    const targetIdx = photoIdx + direction;
    if (targetIdx < 0 || targetIdx >= dbPhotos.length) return;

    // Remove do array original e coloca na nova posição
    const [movedPhoto] = dbPhotos.splice(photoIdx, 1);
    dbPhotos.splice(targetIdx, 0, movedPhoto);

    // Salva a nova indexação de forma consecutiva (1 a N)
    for (let i = 0; i < dbPhotos.length; i++) {
      const newOrder = i + 1;
      await supabase
        .from('photos')
        .update({ sort_order: newOrder })
        .eq('id', dbPhotos[i].id);
    }

    await registrarLog('reorder_photos', { 
      album_id: albumId, 
      photo_id: photoId, 
      details: `Reordenação sequencial consecutiva aplicada.` 
    });

    await carregarAlbums();
    recarregarEditorPeloId(albumId);
  } catch (err) {
    console.error('Erro ao reordenar fotos:', err);
  }
}
window.reordenarFoto = reordenarFoto;

/**
 * Move a foto selecionada para o primeiro índice do álbum e reindexa 1..N
 */
async function definirPrimeiraFoto(albumId, photoId) {
  if (!supabase) return;
  try {
    // Busca fotos ativas ordenadas por sort_order
    const { data: dbPhotos, error } = await supabase
      .from('photos')
      .select('id, sort_order')
      .eq('album_id', albumId)
      .is('deleted_at', null)
      .order('sort_order', { ascending: true });

    if (error) throw error;

    const photoIdx = dbPhotos.findIndex(p => p.id === photoId);
    if (photoIdx === -1) return;

    // Remove da posição atual e insere no início
    const [movedPhoto] = dbPhotos.splice(photoIdx, 1);
    dbPhotos.unshift(movedPhoto);

    // Reindexa de forma sequencial (1..N) no banco
    for (let i = 0; i < dbPhotos.length; i++) {
      const newOrder = i + 1;
      await supabase
        .from('photos')
        .update({ sort_order: newOrder })
        .eq('id', dbPhotos[i].id);
    }

    await registrarLog('set_first_photo', { album_id: albumId, photo_id: photoId });

    await carregarAlbums();
    recarregarEditorPeloId(albumId);
  } catch (err) {
    console.error('Erro ao definir primeira foto:', err);
  }
}
window.definirPrimeiraFoto = definirPrimeiraFoto;

/**
 * Auxiliar para recarregar o painel editor após modificação
 */
async function recarregarEditorPeloId(albumId) {
  try {
    const { data: dbAlbum, error } = await supabase
      .from('albums')
      .select('*, photos(*)')
      .eq('id', albumId)
      .single();

    if (error) throw error;

    const activePhotos = (dbAlbum.photos || []).filter(p => !p.deleted_at);
    dbAlbum.photos = activePhotos.sort((a, b) => a.sort_order - b.sort_order);

    renderEditorFotosAlbum(dbAlbum);
  } catch (e) {
    console.error('Falha ao recarregar painel editor:', e);
  }
}
