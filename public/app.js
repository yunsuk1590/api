const authForm = document.getElementById('auth-form');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const signupBtn = document.getElementById('signup-btn');
const logoutBtn = document.getElementById('logout-btn');
const authStatus = document.getElementById('auth-status');
const authLoggedOut = document.getElementById('auth-logged-out');
const authLoggedIn = document.getElementById('auth-logged-in');
const authEmailDisplay = document.getElementById('auth-email-display');

const profileBox = document.getElementById('profile-box');
const profileForm = document.getElementById('profile-form');
const profileAllergiesInput = document.getElementById('profile-allergies');
const profileDislikesInput = document.getElementById('profile-dislikes');
const profileDietTypeInput = document.getElementById('profile-diet-type');
const profileStatus = document.getElementById('profile-status');

const savedRecipesBox = document.getElementById('saved-recipes-box');
const savedRecipeList = document.getElementById('saved-recipe-list');

const SESSION_KEY = 'fridge_session';

function getSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

function setSession(session, user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, user }));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

function authHeaders() {
  const session = getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}

function updateAuthUI() {
  const session = getSession();
  const loggedIn = Boolean(session);

  authLoggedOut.hidden = loggedIn;
  authLoggedIn.hidden = !loggedIn;
  profileBox.hidden = !loggedIn;
  savedRecipesBox.hidden = !loggedIn;

  if (loggedIn) {
    authEmailDisplay.textContent = session.user?.email || '';
  }
}

function showAuthStatus(message, isError) {
  authStatus.hidden = false;
  authStatus.textContent = message;
  authStatus.classList.toggle('status-error', Boolean(isError));
}

function hideAuthStatus() {
  authStatus.hidden = true;
}

async function handleLogin(e) {
  e.preventDefault();
  await authenticate('/api/auth/login');
}

async function handleSignup() {
  await authenticate('/api/auth/signup');
}

async function authenticate(endpoint) {
  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;
  if (!email || !password) return;

  hideAuthStatus();

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `요청 실패 (status ${res.status})`);
    }

    if (!data.session) {
      showAuthStatus('가입 확인 메일을 확인한 후 로그인해주세요.', false);
      return;
    }

    setSession(data.session, data.user);
    authPasswordInput.value = '';
    updateAuthUI();
    await Promise.all([loadProfile(), loadSavedRecipes()]);
  } catch (err) {
    showAuthStatus(err.message, true);
  }
}

function handleLogout() {
  clearSession();
  updateAuthUI();
}

async function loadProfile() {
  try {
    const res = await fetch('/api/profile', { headers: authHeaders() });
    if (!res.ok) return;
    const profile = await res.json();
    profileAllergiesInput.value = (profile.allergies || []).join(', ');
    profileDislikesInput.value = (profile.dislikes || []).join(', ');
    profileDietTypeInput.value = profile.diet_type || '';
  } catch {
    // 프로필 로드 실패는 조용히 무시 (폼은 비어있는 채로 유지)
  }
}

function parseCommaList(value) {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function handleProfileSubmit(e) {
  e.preventDefault();
  profileStatus.hidden = true;

  try {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({
        allergies: parseCommaList(profileAllergiesInput.value),
        dislikes: parseCommaList(profileDislikesInput.value),
        diet_type: profileDietTypeInput.value.trim(),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `요청 실패 (status ${res.status})`);

    profileStatus.hidden = false;
    profileStatus.classList.remove('status-error');
    profileStatus.textContent = '프로필이 저장되었습니다.';
  } catch (err) {
    profileStatus.hidden = false;
    profileStatus.classList.add('status-error');
    profileStatus.textContent = err.message;
  }
}

async function loadSavedRecipes() {
  try {
    const res = await fetch('/api/recipes/saved', { headers: authHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    renderSavedRecipes(data.recipes || []);
  } catch {
    // 저장된 레시피 로드 실패는 조용히 무시
  }
}

function renderSavedRecipes(recipes) {
  savedRecipeList.innerHTML = '';

  if (recipes.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = '저장된 레시피가 없습니다.';
    savedRecipeList.appendChild(empty);
    return;
  }

  recipes.forEach((recipe) => {
    const card = buildRecipeCard(recipe);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '삭제';
    deleteBtn.className = 'delete-btn';
    deleteBtn.addEventListener('click', async () => {
      deleteBtn.disabled = true;
      try {
        const res = await fetch(`/api/recipes/saved/${recipe.id}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error();
        await loadSavedRecipes();
      } catch {
        deleteBtn.disabled = false;
      }
    });

    card.appendChild(deleteBtn);
    savedRecipeList.appendChild(card);
  });
}

authForm.addEventListener('submit', handleLogin);
signupBtn.addEventListener('click', handleSignup);
logoutBtn.addEventListener('click', handleLogout);
profileForm.addEventListener('submit', handleProfileSubmit);

updateAuthUI();
if (getSession()) {
  loadProfile();
  loadSavedRecipes();
}

const fileInput = document.getElementById('file-input');
const preview = document.getElementById('preview');
const recognizeBtn = document.getElementById('recognize-btn');
const statusBox = document.getElementById('status');
const resultBox = document.getElementById('result');
const itemList = document.getElementById('item-list');
const addItemForm = document.getElementById('add-item-form');
const newItemName = document.getElementById('new-item-name');
const generateRecipesBtn = document.getElementById('generate-recipes-btn');
const recipeStatusBox = document.getElementById('recipe-status');
const recipeResultBox = document.getElementById('recipe-result');
const recipeList = document.getElementById('recipe-list');

let selectedFile = null;
let items = [];

fileInput.addEventListener('change', () => {
  const file = fileInput.files[0];
  if (!file) return;

  selectedFile = file;
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
  recognizeBtn.disabled = false;
  resultBox.hidden = true;
  hideStatus();
});

recognizeBtn.addEventListener('click', recognize);

async function recognize() {
  if (!selectedFile) return;

  recognizeBtn.disabled = true;
  showStatus('인식 중입니다... (무료 모델 특성상 최대 30초 정도 걸릴 수 있어요)', false);

  const formData = new FormData();
  formData.append('image', selectedFile);

  try {
    const res = await fetch('/api/inventory/recognize', { method: 'POST', body: formData });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `요청 실패 (status ${res.status})`);
    }

    items = data.items || [];
    hideStatus();
    renderItems();
  } catch (err) {
    showStatus(`인식에 실패했습니다: ${err.message}`, true);
  } finally {
    recognizeBtn.disabled = false;
  }
}

function showStatus(message, isError) {
  statusBox.hidden = false;
  statusBox.classList.toggle('status-error', isError);
  statusBox.innerHTML = '';

  const text = document.createElement('p');
  text.textContent = message;
  statusBox.appendChild(text);

  if (isError) {
    const retryBtn = document.createElement('button');
    retryBtn.textContent = '다시 시도';
    retryBtn.addEventListener('click', recognize);
    statusBox.appendChild(retryBtn);
  }
}

function hideStatus() {
  statusBox.hidden = true;
}

function renderItems() {
  resultBox.hidden = false;
  itemList.innerHTML = '';

  if (items.length === 0) {
    const empty = document.createElement('li');
    empty.textContent = '인식된 재료가 없습니다. 직접 추가해주세요.';
    itemList.appendChild(empty);
    return;
  }

  items.forEach((item, index) => {
    const li = document.createElement('li');

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = item.name;
    nameInput.addEventListener('input', () => {
      items[index].name = nameInput.value;
    });

    const qtyInput = document.createElement('input');
    qtyInput.type = 'text';
    qtyInput.className = 'qty-input';
    qtyInput.placeholder = '수량';
    qtyInput.value = item.quantity_estimate || '';
    qtyInput.addEventListener('input', () => {
      items[index].quantity_estimate = qtyInput.value;
    });

    const confidenceBadge = document.createElement('span');
    confidenceBadge.className = `confidence confidence-${item.confidence || 'low'}`;
    confidenceBadge.textContent = item.confidence || '-';

    const removeBtn = document.createElement('button');
    removeBtn.textContent = '삭제';
    removeBtn.addEventListener('click', () => {
      items.splice(index, 1);
      renderItems();
    });

    li.append(nameInput, qtyInput, confidenceBadge, removeBtn);
    itemList.appendChild(li);
  });
}

addItemForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = newItemName.value.trim();
  if (!name) return;

  items.push({ name, quantity_estimate: '', confidence: 'manual' });
  newItemName.value = '';
  renderItems();
});

generateRecipesBtn.addEventListener('click', generateRecipes);

async function generateRecipes() {
  if (items.length === 0) {
    showRecipeStatus('먼저 재료를 인식하거나 추가해주세요.', true);
    return;
  }

  generateRecipesBtn.disabled = true;
  recipeResultBox.hidden = true;
  showRecipeStatus('레시피를 생성하는 중입니다...', false);

  try {
    const res = await fetch('/api/recipes/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ items }),
    });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `요청 실패 (status ${res.status})`);
    }

    hideRecipeStatus();
    renderRecipes(data.recipes || []);
  } catch (err) {
    showRecipeStatus(`레시피 생성에 실패했습니다: ${err.message}`, true);
  } finally {
    generateRecipesBtn.disabled = false;
  }
}

function showRecipeStatus(message, isError) {
  recipeStatusBox.hidden = false;
  recipeStatusBox.classList.toggle('status-error', isError);
  recipeStatusBox.innerHTML = '';

  const text = document.createElement('p');
  text.textContent = message;
  recipeStatusBox.appendChild(text);

  if (isError) {
    const retryBtn = document.createElement('button');
    retryBtn.textContent = '다시 시도';
    retryBtn.addEventListener('click', generateRecipes);
    recipeStatusBox.appendChild(retryBtn);
  }
}

function hideRecipeStatus() {
  recipeStatusBox.hidden = true;
}

function buildRecipeCard(recipe) {
  const card = document.createElement('article');
  card.className = 'recipe-card';

  const title = document.createElement('h3');
  title.textContent = recipe.title;

  const meta = document.createElement('p');
  meta.className = 'recipe-meta';
  meta.textContent = `⏱ ${recipe.est_time_min ?? '?'}분 · 난이도 ${recipe.difficulty ?? '-'}`;

  const have = document.createElement('p');
  have.innerHTML = `<strong>보유:</strong> ${(recipe.have || []).join(', ') || '-'}`;

  const need = document.createElement('p');
  need.className = 'recipe-need';
  need.innerHTML = `<strong>추가로 필요:</strong> ${(recipe.need || []).join(', ') || '없음'}`;

  const stepsTitle = document.createElement('p');
  stepsTitle.innerHTML = '<strong>조리법</strong>';

  const stepsList = document.createElement('ol');
  (recipe.steps || []).forEach((step) => {
    const li = document.createElement('li');
    li.textContent = step;
    stepsList.appendChild(li);
  });

  card.append(title, meta, have, need, stepsTitle, stepsList);
  return card;
}

function renderRecipes(recipes) {
  recipeResultBox.hidden = false;
  recipeList.innerHTML = '';

  if (recipes.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = '추천할 수 있는 레시피가 없습니다.';
    recipeList.appendChild(empty);
    return;
  }

  recipes.forEach((recipe) => {
    const card = buildRecipeCard(recipe);

    if (getSession()) {
      const saveBtn = document.createElement('button');
      saveBtn.textContent = '내 레시피에 저장';
      saveBtn.className = 'save-btn';
      saveBtn.addEventListener('click', async () => {
        saveBtn.disabled = true;
        saveBtn.textContent = '저장 중...';
        try {
          const res = await fetch('/api/recipes/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ ...recipe, source_items: items }),
          });
          if (!res.ok) throw new Error();
          saveBtn.textContent = '저장됨 ✓';
          await loadSavedRecipes();
        } catch {
          saveBtn.disabled = false;
          saveBtn.textContent = '내 레시피에 저장';
        }
      });
      card.appendChild(saveBtn);
    }

    recipeList.appendChild(card);
  });
}
