document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('ccaForm');
  if (!form) return;

  const formError = document.getElementById('formError');
  const deleteBtn = document.getElementById('deleteCcaBtn');

  // Get CCA id from URL if on edit page
  const pathParts = window.location.pathname.split('/');
  const isEdit = window.location.pathname.includes('/edit');
  const ccaId = isEdit ? parseInt(pathParts[pathParts.length - 2], 10) : null;

  // On edit page: prefill form with current CCA data
  if (isEdit && ccaId) {
    loadCcaForEdit(ccaId);
  }

  // Handle form submit (create or update)
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    formError.style.display = 'none';

    const formData = new FormData(form);
    const payload = {
      cca_name: formData.get('cca_name'),
      category: formData.get('category'),
      description: formData.get('description'),
      training_day: formData.get('training_day'),
      training_time: formData.get('training_time'),
      location: formData.get('location'),
      contact_information: formData.get('contact_information'),
      image: formData.get('image_url') || null
    };

    try {
      let url;
      if (isEdit && ccaId) {
        url = `${window.API_BASE_URL}/api/ccas/${ccaId}/edit`;
      } else {
        url = `${window.API_BASE_URL}/api/ccas`;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `API error: ${res.status}`);
      }

      // Redirect to CCA list on success
      window.location.href = '/ccas';
    } catch (err) {
      console.error('Failed to save CCA:', err);
      formError.textContent = err.message || 'Failed to save CCA. Make sure the backend server is running.';
      formError.style.display = 'block';
    }
  });

  // Handle delete button on edit page
  if (deleteBtn && ccaId) {
    deleteBtn.addEventListener('click', async function () {
      if (!confirm('Are you sure you want to delete this CCA? This action cannot be undone.')) {
        return;
      }

      try {
        const res = await fetch(`${window.API_BASE_URL}/api/ccas/${ccaId}/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || `API error: ${res.status}`);
        }

        window.location.href = '/ccas';
      } catch (err) {
        console.error('Failed to delete CCA:', err);
        formError.textContent = err.message || 'Failed to delete CCA. Make sure the backend server is running.';
        formError.style.display = 'block';
      }
    });
  }
});

async function loadCcaForEdit(id) {
  const formError = document.getElementById('formError');
  try {
    const res = await fetch(`${window.API_BASE_URL}/api/ccas/${id}`);
    if (!res.ok) {
      if (res.status === 404) {
        formError.textContent = 'CCA not found.';
        formError.style.display = 'block';
        return;
      }
      throw new Error(`API error: ${res.status}`);
    }
    const cca = await res.json();

    document.getElementById('cca_name').value = cca.cca_name || '';
    document.getElementById('category').value = cca.category || '';
    document.getElementById('description').value = cca.description || '';
    document.getElementById('training_day').value = cca.training_day || '';
    document.getElementById('training_time').value = cca.training_time || '';
    document.getElementById('location').value = cca.location || '';
    document.getElementById('contact_information').value = cca.contact_information || '';
    document.getElementById('image_url').value = cca.image || '';
  } catch (err) {
    console.error('Failed to load CCA for edit:', err);
    formError.textContent = 'Could not load CCA data for editing. Make sure the backend server is running.';
    formError.style.display = 'block';
  }
}
