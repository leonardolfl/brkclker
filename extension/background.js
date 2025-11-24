/**
 * CloakerBreaker Enterprise - Background Service Worker
 * Gerencia tarefas em background e comunicação com APIs
 */

// Configuração padrão
const defaultConfig = {
    apiUrl: '',
    supabaseUrl: '',
    supabaseKey: '',
    pollInterval: 30000, // 30 segundos
    maxRetries: 3
};

// Estado dos jobs em monitoramento
const monitoredJobs = new Map();

/**
 * Listener de instalação
 */
chrome.runtime.onInstalled.addListener((details) => {
    console.log('CloakerBreaker Enterprise instalado:', details.reason);
    
    // Inicializa configuração padrão
    chrome.storage.local.get(['cloakerConfig'], (result) => {
        if (!result.cloakerConfig) {
            chrome.storage.local.set({ cloakerConfig: defaultConfig });
        }
    });
});

/**
 * Listener de mensagens do popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case 'submitJobs':
            handleSubmitJobs(message.jobs)
                .then(sendResponse)
                .catch(err => sendResponse({ error: err.message }));
            return true; // Indica resposta assíncrona
            
        case 'checkJobStatus':
            checkJobStatus(message.jobId)
                .then(sendResponse)
                .catch(err => sendResponse({ error: err.message }));
            return true;
            
        case 'updateConfig':
            updateConfig(message.config)
                .then(sendResponse)
                .catch(err => sendResponse({ error: err.message }));
            return true;
            
        case 'getConfig':
            getConfig()
                .then(sendResponse)
                .catch(err => sendResponse({ error: err.message }));
            return true;
            
        default:
            sendResponse({ error: 'Ação desconhecida' });
    }
});

/**
 * Submete múltiplos jobs para processamento
 */
async function handleSubmitJobs(jobs) {
    const config = await getConfig();
    const results = [];
    
    for (const job of jobs) {
        try {
            const result = await submitSingleJob(job, config);
            results.push({ success: true, job: result });
            
            // Adiciona ao monitoramento
            if (result.id) {
                monitoredJobs.set(result.id, {
                    ...result,
                    retries: 0,
                    lastChecked: Date.now()
                });
            }
        } catch (error) {
            results.push({ success: false, error: error.message, job });
        }
    }
    
    // Inicia polling se houver jobs pendentes
    if (monitoredJobs.size > 0) {
        startPolling(config);
    }
    
    return { results };
}

/**
 * Submete um único job
 */
async function submitSingleJob(job, config) {
    if (!config.supabaseUrl || !config.supabaseKey) {
        // Modo demo - retorna job simulado
        return {
            id: `demo_${Date.now()}`,
            ...job,
            status: 'pending',
            created_at: new Date().toISOString()
        };
    }
    
    const response = await fetch(`${config.supabaseUrl}/rest/v1/cloaker_jobs`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': config.supabaseKey,
            'Authorization': `Bearer ${config.supabaseKey}`,
            'Prefer': 'return=representation'
        },
        body: JSON.stringify(job)
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao criar job: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return data[0];
}

/**
 * Verifica status de um job
 */
async function checkJobStatus(jobId) {
    const config = await getConfig();
    
    if (!config.supabaseUrl || !config.supabaseKey) {
        // Modo demo
        return { id: jobId, status: 'completed', result_url: null };
    }
    
    const response = await fetch(
        `${config.supabaseUrl}/rest/v1/cloaker_jobs?id=eq.${jobId}`,
        {
            headers: {
                'apikey': config.supabaseKey,
                'Authorization': `Bearer ${config.supabaseKey}`
            }
        }
    );
    
    if (!response.ok) {
        throw new Error(`Erro ao verificar job: ${response.status}`);
    }
    
    const data = await response.json();
    return data[0] || null;
}

/**
 * Inicia polling para verificar status dos jobs
 */
function startPolling(config) {
    const checkJobs = async () => {
        const completedIds = [];
        
        for (const [jobId, jobData] of monitoredJobs) {
            try {
                const status = await checkJobStatus(jobId);
                
                if (status && (status.status === 'completed' || status.status === 'error')) {
                    completedIds.push(jobId);
                    
                    // Notifica o popup sobre o resultado
                    chrome.runtime.sendMessage({
                        action: 'jobCompleted',
                        job: status
                    }).catch(() => {
                        // Popup pode estar fechado, ignora o erro
                    });
                }
            } catch (error) {
                console.error(`Erro ao verificar job ${jobId}:`, error);
                
                // Incrementa contador de retries
                jobData.retries++;
                
                if (jobData.retries >= config.maxRetries) {
                    completedIds.push(jobId);
                }
            }
        }
        
        // Remove jobs completados do monitoramento
        for (const id of completedIds) {
            monitoredJobs.delete(id);
        }
        
        // Continua polling se ainda houver jobs
        if (monitoredJobs.size > 0) {
            setTimeout(checkJobs, config.pollInterval);
        }
    };
    
    // Inicia após intervalo inicial
    setTimeout(checkJobs, 5000);
}

/**
 * Atualiza configuração
 */
async function updateConfig(newConfig) {
    const currentConfig = await getConfig();
    const mergedConfig = { ...currentConfig, ...newConfig };
    
    await chrome.storage.local.set({ cloakerConfig: mergedConfig });
    return mergedConfig;
}

/**
 * Obtém configuração atual
 */
async function getConfig() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['cloakerConfig'], (result) => {
            resolve(result.cloakerConfig || defaultConfig);
        });
    });
}

// Log de inicialização
console.log('CloakerBreaker Enterprise Service Worker inicializado');
