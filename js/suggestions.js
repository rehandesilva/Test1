// ==================== AUTO-SUGGESTION MODULE ====================
// Manages labor & spare parts suggestions stored in localStorage

const SUGGESTIONS_KEY = 'garage_suggestions';
const MAX_ITEMS = 50;

function getSuggestions() {
    try {
        return JSON.parse(localStorage.getItem(SUGGESTIONS_KEY)) || { labor: [], spareParts: [] };
    } catch { return { labor: [], spareParts: [] }; }
}

function saveSuggestions(data) {
    localStorage.setItem(SUGGESTIONS_KEY, JSON.stringify(data));
}

function addSuggestion(type, value) {
    value = value.trim();
    if (!value) return 'empty';
    const data = getSuggestions();
    const list = data[type] || [];
    if (list.some(i => i.toLowerCase() === value.toLowerCase())) return 'exists';
    list.unshift(value);
    if (list.length > MAX_ITEMS) list.pop();
    data[type] = list;
    saveSuggestions(data);
    return 'saved';
}

function filterSuggestions(type, query) {
    const data = getSuggestions();
    const list = data[type] || [];
    if (!query.trim()) return list.slice(0, 10);
    return list.filter(i => i.toLowerCase().includes(query.toLowerCase())).slice(0, 10);
}

function clearSuggestions(type) {
    const data = getSuggestions();
    data[type] = [];
    saveSuggestions(data);
}

// ── Attach auto-suggestion to a textarea ──────────────────
// type: 'labor' | 'spareParts'
// onSelect: optional callback when suggestion is clicked
function attachSuggestion(textarea, type, onSelect) {
    if (!textarea) return;

    // Wrapper
    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'position:relative;';
    textarea.parentNode.insertBefore(wrapper, textarea);
    wrapper.appendChild(textarea);

    // Dropdown
    const dropdown = document.createElement('div');
    dropdown.style.cssText = `
        display:none;position:absolute;top:100%;left:0;right:0;
        background:var(--surface,#fff);border:1.5px solid var(--border,#E2E8F0);
        border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.12);
        z-index:500;max-height:200px;overflow-y:auto;margin-top:2px;`;
    wrapper.appendChild(dropdown);

    function showDropdown(items) {
        if (!items.length) { dropdown.style.display = 'none'; return; }
        dropdown.innerHTML = items.map(item => `
            <div class="sug-item" style="padding:9px 14px;cursor:pointer;font-size:13.5px;
                color:var(--text-primary,#0F172A);border-bottom:1px solid var(--border,#E2E8F0);
                transition:background 0.15s;"
                onmouseover="this.style.background='var(--surface-3,#F1F5F9)'"
                onmouseout="this.style.background=''"
                data-value="${item.replace(/"/g, '&quot;')}">
                ${item}
            </div>`).join('');
        dropdown.style.display = 'block';

        dropdown.querySelectorAll('.sug-item').forEach(el => {
            el.addEventListener('mousedown', e => {
                e.preventDefault();
                textarea.value = el.dataset.value;
                dropdown.style.display = 'none';
                if (onSelect) onSelect(el.dataset.value);
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
            });
        });
    }

    textarea.addEventListener('input', () => {
        const items = filterSuggestions(type, textarea.value);
        showDropdown(items);
    });

    textarea.addEventListener('focus', () => {
        const items = filterSuggestions(type, textarea.value);
        showDropdown(items);
    });

    textarea.addEventListener('keydown', e => {
        if (e.key === 'Escape') dropdown.style.display = 'none';
    });

    document.addEventListener('click', e => {
        if (!wrapper.contains(e.target)) dropdown.style.display = 'none';
    }, true);
}

// ── Auto-save when a row is removed or bill is saved ──────
// Call this to learn from current form inputs
function learnFromForm() {
    document.querySelectorAll('.repair-desc').forEach(el => {
        if (el.value.trim()) addSuggestion('labor', el.value.trim());
    });
    document.querySelectorAll('.part-desc').forEach(el => {
        if (el.value.trim()) addSuggestion('spareParts', el.value.trim());
    });
}

// ── Patch addRepairRow / addPartRow to attach suggestions ─
function _attachToNewRow(row, type) {
    const textarea = row.querySelector('textarea');
    if (!textarea) return;
    attachSuggestion(textarea, type);
}
