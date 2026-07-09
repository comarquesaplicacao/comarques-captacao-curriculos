document.getElementById('year').textContent = new Date().getFullYear();

const form = document.getElementById('form-curriculo');
const tabs = document.querySelectorAll('.tab');
const steps = document.querySelectorAll('.step');
const msg = document.getElementById('form-msg');
const btnSubmit = document.getElementById('btn-submit');
const btnSubmitLabel = document.getElementById('btn-submit-label');

let currentStep = 1;

function goToStep(step) {
  steps.forEach(s => s.classList.toggle('is-active', Number(s.dataset.step) === step));
  tabs.forEach(t => {
    const n = Number(t.dataset.step);
    t.classList.toggle('is-active', n === step);
    t.classList.toggle('is-done', n < step);
  });
  currentStep = step;
  window.scrollTo({ top: document.querySelector('.folder').offsetTop - 20, behavior: 'smooth' });
}

function validateStep(step) {
  const fieldset = document.querySelector(`.step[data-step="${step}"]`);
  const inputs = fieldset.querySelectorAll('input, select');
  let valid = true;
  inputs.forEach(input => {
    if (!input.checkValidity()) {
      valid = false;
      input.reportValidity();
    }
  });
  return valid;
}

document.querySelectorAll('[data-next]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (validateStep(currentStep)) goToStep(currentStep + 1);
  });
});

document.querySelectorAll('[data-prev]').forEach(btn => {
  btn.addEventListener('click', () => goToStep(currentStep - 1));
});

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const target = Number(tab.dataset.step);
    if (target < currentStep) goToStep(target);
  });
});

/* ---------- Upload de arquivo ---------- */
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('arquivo');
const fileNameEl = document.getElementById('file-name');
const dropzoneContent = document.getElementById('dropzone-content');

const MAX_FILE_MB = 10;

dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('is-dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('is-dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('is-dragover');
  if (e.dataTransfer.files.length) {
    fileInput.files = e.dataTransfer.files;
    handleFileSelected();
  }
});

fileInput.addEventListener('change', handleFileSelected);

function handleFileSelected() {
  const file = fileInput.files[0];
  if (!file) return;

  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    showMsg(`O arquivo excede ${MAX_FILE_MB} MB. Escolha um arquivo menor.`, 'error');
    fileInput.value = '';
    fileNameEl.textContent = '';
    return;
  }

  fileNameEl.textContent = `📄 ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.readAsDataURL(file);
  });
}

/* ---------- Envio ---------- */
function showMsg(text, type) {
  msg.textContent = text;
  msg.className = `form-msg is-visible is-${type}`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!validateStep(3)) return;

  const file = fileInput.files[0];
  if (!file) {
    showMsg('Anexe seu currículo antes de enviar.', 'error');
    return;
  }

  btnSubmit.disabled = true;
  btnSubmitLabel.textContent = 'Enviando...';
  showMsg('Enviando seu currículo, aguarde...', 'success');

  try {
    const base64 = await fileToBase64(file);

    const payload = {
      nomeCompleto: form.nomeCompleto.value.trim(),
      telefone: form.telefone.value.trim(),
      email: form.email.value.trim(),
      estado: form.estado.value,
      cidade: form.cidade.value.trim(),
      bairro: form.bairro.value.trim(),
      dataNascimento: form.dataNascimento.value,
      cargoDesejado: form.cargoDesejado.value.trim(),
      escolaridade: form.escolaridade.value,
      pretensaoSalarial: form.pretensaoSalarial.value,
      disponibilidade: form.disponibilidade.value,
      veiculoProprio: form.veiculoProprio.value,
      arquivo: {
        nome: file.name,
        mimeType: file.type || 'application/octet-stream',
        base64: base64
      }
    };

    const response = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS no Apps Script
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (result.ok) {
      showSuccessState();
    } else {
      showMsg(result.message || 'Não foi possível enviar. Tente novamente.', 'error');
      btnSubmit.disabled = false;
      btnSubmitLabel.textContent = 'Enviar currículo';
    }
  } catch (err) {
    showMsg('Erro de conexão. Verifique sua internet e tente novamente.', 'error');
    btnSubmit.disabled = false;
    btnSubmitLabel.textContent = 'Enviar currículo';
  }
});

function showSuccessState() {
  document.querySelector('.card').innerHTML = `
    <div style="text-align:center; padding: 20px 4px;">
      <div style="font-size:40px;">✅</div>
      <h2 style="font-family:'Sora',sans-serif; color:var(--purple-deep); margin: 14px 0 8px;">
        Currículo recebido!
      </h2>
      <p style="color:var(--ink-soft); font-size:14.5px; line-height:1.6;">
        Obrigado por se candidatar. Guardamos seus dados e currículo com cuidado —
        entraremos em contato caso surja uma oportunidade compatível com o seu perfil.
      </p>
    </div>
  `;
  document.getElementById('tabs').style.display = 'none';
}
