document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('ccaForm');
  if (!form) return;

  const formError = document.getElementById('formError');

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    formError.style.display = 'none';

    const formData = new FormData(form);
    const payload = {
      cca_name: formData.get('cca_name'),
      category: formData.get('category'),
      description: formData.get('description'),
      training_day: formData.get('training_day'),
      training_time: formData.get('training_time') || null,
      location: formData.get('location'),
      contact_information: formData.get('contact_information'),
      image: (formData.get('image_url') || '').trim() || null
    };

    console.log('CCA create payload:', payload);

    try {
      const res = await fetch(`${window.API_BASE_URL}/api/ccas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `API error: ${res.status}`);
      }

      window.location.href = '/ccas';
    } catch (err) {
      console.error('Failed to create CCA:', err);
      formError.textContent = err.message || 'Failed to create CCA. Make sure the backend server is running.';
      formError.style.display = 'block';
    }
  });
});