/**
 * CloakerBreaker Enterprise - Popup JavaScript
 * Gerencia a interface do usuário e comunicação com o serviço backend
 */

// Configurações
const CONFIG = {
    // URL do serviço de API (Supabase Functions ou seu próprio backend)
    apiUrl: '', // Será configurado pelo usuário
    supabaseUrl: '',
    supabaseKey: ''
};

// Estado da aplicação
const state = {
    selectedDevices: ['desktop'],
    selectedPlatforms: ['facebook'],
    selectedRegions: ['br'],
    selectedLanguages: ['pt'],
    isProcessing: false,
    jobs: []
};

// Elementos DOM
const elements = {};

/**
 * Inicializa a extensão
 */
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    loadSavedConfig();
    bindEvents();
    updateScenarioCount();
});

/**
 * Inicializa referências aos elementos DOM
 */
function initializeElements() {
    elements.targetUrl = document.getElementById('targetUrl');
    elements.getCurrentUrlBtn = document.getElementById('getCurrentUrl');
    elements.submitBtn = document.getElementById('submitBtn');
    elements.selectAllBtn = document.getElementById('selectAllBtn');
    elements.clearAllBtn = document.getElementById('clearAllBtn');
    elements.scenarioCount = document.getElementById('scenarioCount');
    elements.statusArea = document.getElementById('statusArea');
    elements.statusText = document.getElementById('statusText');
    elements.progressFill = document.getElementById('progressFill');
    elements.statusList = document.getElementById('statusList');
    elements.resultsArea = document.getElementById('resultsArea');
    elements.resultsList = document.getElementById('resultsList');
    
    // Grupos de checkbox
    elements.deviceGroup = document.getElementById('deviceGroup');
    elements.platformGroup = document.getElementById('platformGroup');
    elements.regionGroup = document.getElementById('regionGroup');
    elements.languageGroup = document.getElementById('languageGroup');
}

/**
 * Carrega configuração salva do storage
 */
async function loadSavedConfig() {
    try {
        const result = await chrome.storage.local.get(['cloakerConfig']);
        if (result.cloakerConfig) {
            CONFIG.apiUrl = result.cloakerConfig.apiUrl || '';
            CONFIG.supabaseUrl = result.cloakerConfig.supabaseUrl || '';
            CONFIG.supabaseKey = result.cloakerConfig.supabaseKey || '';
        }
    } catch (e) {
        console.log('Não foi possível carregar configuração:', e);
    }
}

/**
 * Vincula eventos aos elementos
 */
function bindEvents() {
    // Botão de URL atual
    elements.getCurrentUrlBtn.addEventListener('click', getCurrentTabUrl);
    
    // Botão de submissão
    elements.submitBtn.addEventListener('click', handleSubmit);
    
    // Botões de seleção
    elements.selectAllBtn.addEventListener('click', selectAll);
    elements.clearAllBtn.addEventListener('click', clearAll);
    
    // Listeners para checkboxes
    const checkboxGroups = [
        { group: elements.deviceGroup, state: 'selectedDevices' },
        { group: elements.platformGroup, state: 'selectedPlatforms' },
        { group: elements.regionGroup, state: 'selectedRegions' },
        { group: elements.languageGroup, state: 'selectedLanguages' }
    ];
    
    checkboxGroups.forEach(({ group, state: stateKey }) => {
        group.addEventListener('change', (e) => {
            if (e.target.type === 'checkbox') {
                updateSelection(stateKey, e.target.value, e.target.checked);
            }
        });
    });
}

/**
 * Obtém URL da aba atual
 */
async function getCurrentTabUrl() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url) {
            elements.targetUrl.value = tab.url;
        }
    } catch (e) {
        console.error('Erro ao obter URL:', e);
    }
}

/**
 * Atualiza seleção de uma categoria
 */
function updateSelection(stateKey, value, isChecked) {
    if (isChecked) {
        if (!state[stateKey].includes(value)) {
            state[stateKey].push(value);
        }
    } else {
        state[stateKey] = state[stateKey].filter(v => v !== value);
    }
    updateScenarioCount();
}

/**
 * Atualiza contador de cenários
 */
function updateScenarioCount() {
    const count = state.selectedDevices.length * 
                  state.selectedPlatforms.length * 
                  state.selectedRegions.length * 
                  state.selectedLanguages.length;
    elements.scenarioCount.textContent = count;
}

/**
 * Seleciona todos os checkboxes
 */
function selectAll() {
    const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    allCheckboxes.forEach(cb => {
        cb.checked = true;
        const group = cb.name;
        const value = cb.value;
        const stateKey = getStateKeyFromGroup(group);
        if (stateKey && !state[stateKey].includes(value)) {
            state[stateKey].push(value);
        }
    });
    updateScenarioCount();
}

/**
 * Limpa seleção de checkboxes
 */
function clearAll() {
    const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    allCheckboxes.forEach(cb => {
        cb.checked = false;
    });
    state.selectedDevices = [];
    state.selectedPlatforms = [];
    state.selectedRegions = [];
    state.selectedLanguages = [];
    updateScenarioCount();
}

/**
 * Mapeia nome do grupo para chave do state
 */
function getStateKeyFromGroup(group) {
    const map = {
        'device': 'selectedDevices',
        'platform': 'selectedPlatforms',
        'region': 'selectedRegions',
        'language': 'selectedLanguages'
    };
    return map[group];
}

/**
 * Gera cenários baseados nas seleções
 */
function generateScenarios(targetUrl) {
    const scenarios = [];
    
    for (const device of state.selectedDevices) {
        for (const platform of state.selectedPlatforms) {
            for (const region of state.selectedRegions) {
                for (const language of state.selectedLanguages) {
                    scenarios.push({
                        target_url: targetUrl,
                        device_config: device,
                        platform_config: platform,
                        proxy_config: region,
                        lang_config: language,
                        status: 'pending'
                    });
                }
            }
        }
    }
    
    return scenarios;
}

/**
 * Manipula submissão do formulário
 */
async function handleSubmit() {
    const targetUrl = elements.targetUrl.value.trim();
    
    // Validação
    if (!targetUrl) {
        showError('Por favor, insira uma URL válida.');
        return;
    }
    
    if (!isValidUrl(targetUrl)) {
        showError('URL inválida. Inclua http:// ou https://');
        return;
    }
    
    if (state.selectedDevices.length === 0 ||
        state.selectedPlatforms.length === 0 ||
        state.selectedRegions.length === 0 ||
        state.selectedLanguages.length === 0) {
        showError('Selecione pelo menos uma opção em cada categoria.');
        return;
    }
    
    // Gerar cenários
    const scenarios = generateScenarios(targetUrl);
    
    // Mostrar área de status
    elements.statusArea.style.display = 'block';
    elements.resultsArea.style.display = 'none';
    elements.submitBtn.disabled = true;
    state.isProcessing = true;
    
    // Enviar para processamento
    await processScenarios(scenarios);
}

/**
 * Valida URL
 */
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Processa cenários enviando para o backend
 */
async function processScenarios(scenarios) {
    const total = scenarios.length;
    let completed = 0;
    
    elements.statusList.innerHTML = '';
    state.jobs = [];
    
    for (const scenario of scenarios) {
        const scenarioId = `${scenario.device_config}_${scenario.platform_config}_${scenario.proxy_config}_${scenario.lang_config}`;
        
        try {
            updateStatus(`Enviando cenário: ${scenarioId}...`, (completed / total) * 100);
            
            // Envia para o backend (Supabase ou API própria)
            const job = await submitJob(scenario);
            
            state.jobs.push({
                ...scenario,
                id: job?.id || Date.now(),
                status: 'pending'
            });
            
            addStatusItem(`✅ ${scenarioId} - Enviado`, 'success');
            
        } catch (error) {
            addStatusItem(`❌ ${scenarioId} - Erro: ${error.message}`, 'error');
            state.jobs.push({
                ...scenario,
                id: Date.now(),
                status: 'error',
                error: error.message
            });
        }
        
        completed++;
        updateStatus(`Processando: ${completed}/${total}`, (completed / total) * 100);
    }
    
    // Finalizar
    updateStatus(`Concluído: ${total} cenários enviados`, 100);
    elements.submitBtn.disabled = false;
    state.isProcessing = false;
    
    // Mostrar resultados
    showResults();
}

/**
 * Envia job para o backend
 */
async function submitJob(scenario) {
    // Se Supabase estiver configurado, usa diretamente
    if (CONFIG.supabaseUrl && CONFIG.supabaseKey) {
        const response = await fetch(`${CONFIG.supabaseUrl}/rest/v1/cloaker_jobs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': CONFIG.supabaseKey,
                'Authorization': `Bearer ${CONFIG.supabaseKey}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(scenario)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        return data[0];
    }
    
    // Se API própria estiver configurada
    if (CONFIG.apiUrl) {
        const response = await fetch(`${CONFIG.apiUrl}/jobs`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(scenario)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
    }
    
    // Mock para demonstração (sem backend configurado)
    console.log('Job enviado (modo demo):', scenario);
    return { id: Date.now(), ...scenario };
}

/**
 * Atualiza status de progresso
 */
function updateStatus(text, progress) {
    elements.statusText.textContent = text;
    elements.progressFill.style.width = `${progress}%`;
}

/**
 * Adiciona item à lista de status
 */
function addStatusItem(text, type = '') {
    const li = document.createElement('li');
    li.textContent = text;
    li.className = type;
    elements.statusList.insertBefore(li, elements.statusList.firstChild);
}

/**
 * Mostra resultados
 */
function showResults() {
    elements.resultsArea.style.display = 'block';
    elements.resultsList.innerHTML = '';
    
    for (const job of state.jobs) {
        const div = document.createElement('div');
        div.className = 'result-item';
        
        const scenario = `${job.device_config} | ${job.platform_config} | ${job.proxy_config} | ${job.lang_config}`;
        
        div.innerHTML = `
            <span class="scenario">${scenario}</span>
            <span class="status ${job.status}">${job.status}</span>
            ${job.result_url ? `<a href="${job.result_url}" target="_blank">📸</a>` : ''}
        `;
        
        elements.resultsList.appendChild(div);
    }
}

/**
 * Mostra mensagem de erro
 */
function showError(message) {
    elements.statusArea.style.display = 'block';
    updateStatus(`❌ ${message}`, 0);
    addStatusItem(message, 'error');
}
