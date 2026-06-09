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
  atualizarInterfaceAdmin(session);
}

/**
 * Configura a alternância de telas (Tabs) no painel
 */
function setupDashboardTabs() {
  const tabNewAlbum = document.getElementById('tabNewAlbum');
  const tabTrash = document.getElementById('tabTrash');
  const tabLogs = document.getElementById('tabLogs');
  const tabBackup = document.getElementById('tabBackup');

  const contentAlbumForm = document.getElementById('contentAlbumForm');
  const contentTrash = document.getElementById('contentTrash');
  const contentLogs = document.getElementById('contentLogs');
  const contentBackup = document.getElementById('contentBackup');

  const tabs = [tabNewAlbum, tabTrash, tabLogs, tabBackup];
  const contents = [contentAlbumForm, contentTrash, contentLogs, contentBackup];

  tabs.forEach((tab, index) => {
    tab?.addEventListener('click', () => {
      tabs.forEach(t => t?.classList.remove('gold'));
      tab?.classList.add('gold');

      contents.forEach(c => c?.classList.add('hidden'));
      contents[index]?.classList.remove('hidden');

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
    carregarMetricas();
  } else {
    ownerLocked?.classList.remove('hidden');
    ownerTools?.classList.add('hidden');
  }

  // Atualizar visibilidade de elementos administrativos na página principal
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('visible', isOwner);
  });
}

/**
 * Escreve um log de auditoria no Supabase
 */
async function registrarLog(action, details = null) {
  if (!supabase) return;
  try {
    await supabase.from('admin_logs').insert({ action, details });
  } catch (err) {
    console.error('Falha ao escrever log no banco:', err);
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
    registrarLog('login', `Email: ${email}`);
    await atualizarInterfaceAdmin(data.session);
    alert('Acesso autorizado com sucesso!');
    carregarAlbums(); // recarregar galeria no modo admin
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
    carregarAlbums(); // recarregar galeria normal
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

    // 2. Total de fotos ativas
    const { count: countPhotos } = await supabase
      .from('photos')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null);

    // 3. Total de itens na lixeira (álbuns deletados)
    const { count: countTrash } = await supabase
      .from('albums')
      .select('*', { count: 'exact', head: true })
      .not('deleted_at', 'is', null);

    metricAlbums.textContent = countAlbums || 0;
    metricPhotos.textContent = countPhotos || 0;
    metricTrash.textContent = countTrash || 0;
  } catch (err) {
    console.error('Falha ao carregar métricas:', err);
  }
}

/**
 * Carrega a Lixeira (Soft Delete)
 */
async function carregarLixeira() {
  const trashList = document.getElementById('trashList');
  if (!supabase || !trashList) return;

  try {
    // Busca álbuns deletados
    const { data: deletedAlbums, error } = await supabase
      .from('albums')
      .select('*, photos(*)')
      .not('deleted_at', 'is', null);

    if (error) throw error;

    if (!deletedAlbums || !deletedAlbums.length) {
      trashList.innerHTML = '<p class="text-dim" style="font-size:0.8rem; padding: 1rem 0;">A lixeira está vazia.</p>';
      return;
    }

    trashList.innerHTML = deletedAlbums.map(album => `
      <div class="trash-item">
        <div class="trash-info">
          <span class="trash-title">${escapeHtml(album.title)}</span>
          <p class="trash-meta">
            ${escapeHtml(formatDate(album.date))} · ${album.photos ? album.photos.length : 0} foto(s)
            <br>
            Deletado em: ${escapeHtml(new Date(album.deleted_at).toLocaleString('pt-BR'))}
          </p>
        </div>
        <div class="trash-actions">
          <button class="mini-btn gold" onclick="window.restaurarAlbum('${album.id}')" style="min-height:36px; padding:0 0.8rem;">Restaurar</button>
          <button class="mini-btn danger" onclick="window.expurgarAlbum('${album.id}')" style="min-height:36px; padding:0 0.8rem; border-color:#ff5555; color:#ff5555;">Expurgar</button>
        </div>
      </div>
    `).join('');

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
    await registrarLog('restore_album', `ID do Álbum: ${id}`);
    carregarLixeira();
    carregarMetricas();
    carregarAlbums();
  } catch (err) {
    alert('Erro ao restaurar: ' + err.message);
  }
}
window.restaurarAlbum = restaurarAlbum;

/**
 * Exclui permanentemente o álbum e suas imagens (Purge)
 */
async function expurgarAlbum(id) {
  if (!supabase) return;
  if (!confirm('Esta ação é definitiva e removerá permanentemente todos os registros do banco e os arquivos do Storage. Deseja continuar?')) return;

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
        // Extrai o caminho relativo após /storage/v1/object/public/photos/
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
    await registrarLog('hard_delete_album', `ID do Álbum: ${id}`);
    carregarLixeira();
    carregarMetricas();
    carregarAlbums();
  } catch (err) {
    alert('Erro ao expurgar: ' + err.message);
  }
}
window.expurgarAlbum = expurgarAlbum;

/**
 * Carrega a lista de logs administrativos
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

    logsList.innerHTML = logs.map(log => `
      <div class="log-item">
        <span class="log-details"><strong>[${escapeHtml(log.action.toUpperCase())}]</strong> ${escapeHtml(log.details || '')}</span>
        <span class="log-date">${escapeHtml(new Date(log.created_at).toLocaleString('pt-BR'))}</span>
      </div>
    `).join('');

  } catch (err) {
    console.error('Erro ao carregar logs:', err);
    logsList.innerHTML = '<p class="text-dim" style="font-size:0.8rem; padding: 1rem;">Erro ao carregar logs.</p>';
  }
}

/**
 * Exporta todos os dados relacionais do portfólio em um arquivo JSON
 */
async function exportarBackup() {
  if (!supabase) return;
  try {
    const { data: dbAlbums, error: errorAlbums } = await supabase.from('albums').select('*');
    const { data: dbPhotos, error: errorPhotos } = await supabase.from('photos').select('*');
    
    if (errorAlbums || errorPhotos) throw errorAlbums || errorPhotos;

    const backupData = {
      timestamp: new Date().toISOString(),
      albums: dbAlbums || [],
      photos: dbPhotos || []
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_kauan_portfolio_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    await registrarLog('backup_exported', `Total de álbuns: ${backupData.albums.length}`);
    alert('Cópia de segurança gerada com sucesso!');
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
    // Processamento com compressão e geração de tiers
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
  // Converte dataUri para Blob
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
      cacheControl: '31536000', // 1 ano cache
      upsert: true
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('photos')
    .getPublicUrl(path);

  return publicUrl;
}

/**
 * Cria ou edita um álbum no Supabase, enviando as fotos no Storage em 3 tiers
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
      await registrarLog('edit_album', `Álbum editado: ${title} (${albumId})`);
    } else {
      // Criação de álbum - busca maior sort_order para definir a ordem sequencial
      const { data: lastAlbums } = await supabase
        .from('albums')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextOrder = lastAlbums && lastAlbums.length ? lastAlbums[0].sort_order + 1 : 0;

      const { data: newAlbum, error } = await supabase
        .from('albums')
        .insert({ title, slug, date, local, cat, note, status, sort_order: nextOrder, is_featured: isFeatured })
        .select()
        .single();

      if (error) throw error;
      albumId = newAlbum.id;
      await registrarLog('create_album', `Álbum criado: ${title}`);
    }

    // 2. Upload e salvamento de novas fotos (se houver na fila)
    if (pendingPhotos.length) {
      // Busca a maior ordenação das fotos do álbum para salvar no final
      const { data: lastPhotos } = await supabase
        .from('photos')
        .select('sort_order')
        .eq('album_id', albumId)
        .order('sort_order', { ascending: false })
        .limit(1);

      let startOrder = lastPhotos && lastPhotos.length ? lastPhotos[0].sort_order + 1 : 0;

      for (let i = 0; i < pendingPhotos.length; i++) {
        const photo = pendingPhotos[i];
        
        // Atualiza UI de progresso
        const progressFill = document.getElementById(`progressFill_${i}`);
        if (progressFill) progressFill.style.width = '20%';

        const cleanPhotoName = slugify(photo.name);
        const uuidName = crypto.randomUUID();

        // Caminhos organizados em pastas no Storage
        const pathOriginal = `albums/${slug}/original/${uuidName}_${cleanPhotoName}.jpg`;
        const pathOptimized = `albums/${slug}/optimized/${uuidName}_${cleanPhotoName}.jpg`;
        const pathThumbnail = `albums/${slug}/thumbnail/${uuidName}_${cleanPhotoName}.jpg`;

        if (progressFill) progressFill.style.width = '40%';

        // Upload das imagens em 3 tiers
        const urlOriginal = await uploadTierToStorage(photo.original.src, pathOriginal, 'image/jpeg');
        if (progressFill) progressFill.style.width = '60%';

        const urlOptimized = await uploadTierToStorage(photo.optimized.src, pathOptimized, 'image/jpeg');
        if (progressFill) progressFill.style.width = '80%';

        const urlThumbnail = await uploadTierToStorage(photo.thumbnail.src, pathThumbnail, 'image/jpeg');
        if (progressFill) progressFill.style.width = '100%';

        // Registrar no banco de dados public.photos
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
            sort_order: startOrder + i
          });

        if (photoDbError) throw photoDbError;
      }
      
      await registrarLog('upload_photos', `Upload de ${pendingPhotos.length} fotos no álbum ${title}`);
    }

    // Se criou álbum, tentar definir a primeira imagem cadastrada como cover do álbum caso cover_url seja nulo
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
    
    // Ir para a galeria ver o resultado
    document.getElementById('galeria')?.scrollIntoView({ behavior: 'smooth' });

  } catch (err) {
    console.error('Falha na transação:', err);
    alert('Erro ao publicar: ' + err.message);
    if (successMsg) successMsg.style.display = 'none';
  } finally {
    saveAlbumBtn.disabled = false;
  }
}

/**
 * Limpa todos os campos do formulário administrativamente
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
  
  // Remover editor de fotos auxiliares da tela se existir
  const extPhotoEditor = document.getElementById('albumPhotosEditor');
  if (extPhotoEditor) extPhotoEditor.remove();

  renderFilaUpload();
}

/**
 * Ativa o modo de edição de um álbum existente
 */
export async function iniciarEdicaoAlbum(albumId) {
  const album = albums.find(a => a.id === albumId);
  if (!album) return;

  // Ativar aba Novo Álbum
  document.getElementById('tabNewAlbum')?.click();

  isEditing = true;
  currentEditingAlbumId = albumId;

  document.getElementById('formAlbumTitle').textContent = `Editar Álbum: ${album.title}`;
  saveAlbumBtn.textContent = 'Salvar Alterações';

  evTitle.value = album.title;
  evDate.value = album.date;
  evLocal.value = album.local || '';
  evNota.value = album.note || '';
  evStatus.value = album.status;
  evFeatured.checked = album.is_featured || false;

  // Carregar editor de fotos associadas
  renderEditorFotosAlbum(album);
}
window.iniciarEdicaoAlbum = iniciarEdicaoAlbum;

/**
 * Renderiza mini-painel para gerenciar ordenação, capa e exclusão de fotos do álbum em edição
 */
function renderEditorFotosAlbum(album) {
  const form = document.getElementById('contentAlbumForm');
  
  // Remove anterior
  document.getElementById('albumPhotosEditor')?.remove();

  const editorDiv = document.createElement('div');
  editorDiv.id = 'albumPhotosEditor';
  editorDiv.className = 'album-photos-editor';
  
  editorDiv.innerHTML = `
    <h4 class="form-label" style="color:var(--gold);">Fotos Ativas (${album.photos.length})</h4>
    <p class="sec-sub" style="font-size:0.7rem; margin-bottom:1rem;">Defina a imagem de capa do álbum, reordene-as ou delete-as individualmente.</p>
    <div class="editor-photos-grid">
      ${album.photos.map((photo, index) => {
        const isCover = album.cover_url === photo.src;
        return `
          <div class="editor-photo-card" id="photoCard_${photo.id}">
            <img src="${photo.thumbnail_src || photo.src}" alt="Thumb">
            <div class="editor-photo-actions">
              <button class="editor-photo-btn ${isCover ? 'active' : ''}" onclick="window.definirCapaAlbum('${album.id}', '${photo.src}')" title="Usar como capa do Álbum">
                ★
              </button>
              <button class="editor-photo-btn" onclick="window.reordenarFoto('${album.id}', '${photo.id}', -1)" title="Mover para cima/esquerda">
                ←
              </button>
              <button class="editor-photo-btn" onclick="window.reordenarFoto('${album.id}', '${photo.id}', 1)" title="Mover para baixo/direita">
                →
              </button>
              <button class="editor-photo-btn danger" onclick="window.excluirFotoAlbum('${album.id}', '${photo.id}')" title="Excluir Foto">
                ✕
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Insere antes dos botões de ação final
  form.insertBefore(editorDiv, form.querySelector('.owner-actions'));
}

/**
 * Define a foto selecionada como a capa oficial do álbum
 */
async function definirCapaAlbum(albumId, photoUrl) {
  if (!supabase) return;
  try {
    const { error } = await supabase
      .from('albums')
      .update({ cover_url: photoUrl })
      .eq('id', albumId);

    if (error) throw error;
    alert('Imagem definida como capa do álbum!');
    
    // Atualizar UI
    await carregarAlbums();
    const album = albums.find(a => a.id === albumId);
    if (album) renderEditorFotosAlbum(album);
  } catch (err) {
    alert('Erro ao definir capa: ' + err.message);
  }
}
window.definirCapaAlbum = definirCapaAlbum;

/**
 * Exclui fisicamente a foto (tanto do Storage quanto da tabela photos)
 */
async function excluirFotoAlbum(albumId, photoId) {
  if (!supabase) return;
  if (!confirm('Deseja excluir definitivamente esta foto?')) return;

  try {
    // 1. Obter URLs dos arquivos para exclusão física no Storage
    const { data: photo, error: selectError } = await supabase
      .from('photos')
      .select('src, thumbnail_src, original_src')
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
    }

    // 2. Excluir do banco
    const { error: dbError } = await supabase
      .from('photos')
      .delete()
      .eq('id', photoId);

    if (dbError) throw dbError;

    alert('Foto removida com sucesso!');
    await registrarLog('delete_photo', `ID da Foto: ${photoId} no álbum ${albumId}`);

    // Recarregar
    await carregarAlbums();
    const album = albums.find(a => a.id === albumId);
    if (album) {
      renderEditorFotosAlbum(album);
    } else {
      limparFormulario();
    }
    carregarMetricas();
  } catch (err) {
    alert('Erro ao excluir foto: ' + err.message);
  }
}
window.excluirFotoAlbum = excluirFotoAlbum;

/**
 * Reordena fotos alterando o sort_order no banco
 */
async function reordenarFoto(albumId, photoId, direction) {
  if (!supabase) return;
  const album = albums.find(a => a.id === albumId);
  if (!album) return;

  const photoIdx = album.photos.findIndex(p => p.id === photoId);
  if (photoIdx === -1) return;

  const targetIdx = photoIdx + direction;
  if (targetIdx < 0 || targetIdx >= album.photos.length) return; // Limites da fila

  try {
    const activePhoto = album.photos[photoIdx];
    const targetPhoto = album.photos[targetIdx];

    // Troca os sort_order no banco
    const orderActive = activePhoto.sort_order;
    const orderTarget = targetPhoto.sort_order;

    const { error: err1 } = await supabase.from('photos').update({ sort_order: orderTarget }).eq('id', activePhoto.id);
    const { error: err2 } = await supabase.from('photos').update({ sort_order: orderActive }).eq('id', targetPhoto.id);

    if (err1 || err2) throw err1 || err2;

    // Recarrega dados
    await carregarAlbums();
    const updatedAlbum = albums.find(a => a.id === albumId);
    if (updatedAlbum) renderEditorFotosAlbum(updatedAlbum);

  } catch (err) {
    console.error('Erro na reordenação:', err);
  }
}
window.reordenarFoto = reordenarFoto;
