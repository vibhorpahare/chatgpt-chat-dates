const refreshBtn = document.getElementById('refreshBtn');
const searchBox = document.getElementById('searchBox');
const statusEl = document.getElementById('status');
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');

let conversations = [];

function setStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', !!isError);
}

function fmtDateHeader(ts) {
  return new Date(ts * 1000).toLocaleDateString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtTime(ts) {
  return new Date(ts * 1000).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function render() {
  const query = searchBox.value.trim().toLowerCase();
  const filtered = query
    ? conversations.filter((c) => c.title.toLowerCase().includes(query))
    : conversations;

  listEl.innerHTML = '';
  emptyEl.style.display = filtered.length ? 'none' : 'block';
  if (!filtered.length) {
    emptyEl.textContent = conversations.length
      ? 'No chats match that search.'
      : 'No chats yet. Open chatgpt.com and hit Refresh.';
    return;
  }

  const sorted = [...filtered].sort((a, b) => b.create_time - a.create_time);

  let lastDateKey = null;
  for (const c of sorted) {
    const dateKey = fmtDateHeader(c.create_time);
    if (dateKey !== lastDateKey) {
      const header = document.createElement('div');
      header.className = 'dateHeader';
      header.textContent = dateKey;
      listEl.appendChild(header);
      lastDateKey = dateKey;
    }

    const row = document.createElement('div');
    row.className = 'row';

    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = c.title || '(untitled)';
    title.title = c.title || '(untitled)';
    row.appendChild(title);

    const time = document.createElement('div');
    time.className = 'time';
    time.textContent = fmtTime(c.create_time);
    row.appendChild(time);

    row.addEventListener('click', () => {
      chrome.tabs.create({ url: `https://chatgpt.com/c/${c.id}` });
    });

    listEl.appendChild(row);
  }
}

searchBox.addEventListener('input', render);

async function loadCache() {
  const { conversations: cached, lastSynced } = await chrome.storage.local.get([
    'conversations',
    'lastSynced',
  ]);
  conversations = cached || [];
  if (lastSynced) {
    setStatus(`${conversations.length} chats · last synced ${new Date(lastSynced).toLocaleString()}`);
  } else {
    setStatus('');
  }
  render();
}

function fetchAllConversations() {
  return (async () => {
    const sessRes = await fetch('/api/auth/session', { credentials: 'include' });
    const sess = await sessRes.json();
    const token = sess.accessToken;
    if (!token) throw new Error('Not logged in to ChatGPT');

    let all = [];
    let offset = 0;
    const limit = 100;
    while (true) {
      const r = await fetch(
        `/backend-api/conversations?offset=${offset}&limit=${limit}&order=updated`,
        { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' }
      );
      if (!r.ok) throw new Error(`API error ${r.status}`);
      const j = await r.json();
      const items = j.items || [];
      all.push(...items);
      if (items.length < limit) break;
      offset += limit;
    }

    return all.map((c) => ({
      id: c.id,
      title: c.title || '(untitled)',
      create_time: c.create_time,
      update_time: c.update_time,
    }));
  })();
}

async function findOrOpenChatGptTab() {
  const tabs = await chrome.tabs.query({ url: 'https://chatgpt.com/*' });
  if (tabs.length) return { tab: tabs[0], createdByUs: false };

  const tab = await chrome.tabs.create({ url: 'https://chatgpt.com/', active: false });
  await new Promise((resolve) => {
    function listener(tabId, info) {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
  return { tab, createdByUs: true };
}

refreshBtn.addEventListener('click', async () => {
  refreshBtn.disabled = true;
  setStatus('Syncing with ChatGPT...');
  let createdByUs = false;
  let tabId = null;

  try {
    const found = await findOrOpenChatGptTab();
    createdByUs = found.createdByUs;
    tabId = found.tab.id;

    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId },
      func: fetchAllConversations,
    });

    conversations = injectionResults[0].result;
    const lastSynced = Date.now();
    await chrome.storage.local.set({ conversations, lastSynced });
    setStatus(`${conversations.length} chats · last synced ${new Date(lastSynced).toLocaleString()}`);
    render();
  } catch (e) {
    setStatus(`Sync failed: ${e.message || e}. Make sure you're logged into chatgpt.com.`, true);
  } finally {
    if (createdByUs && tabId != null) {
      chrome.tabs.remove(tabId).catch(() => {});
    }
    refreshBtn.disabled = false;
  }
});

loadCache();
