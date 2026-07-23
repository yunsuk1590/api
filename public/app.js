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
      headers: { 'Content-Type': 'application/json' },
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
    recipeList.appendChild(card);
  });
}
