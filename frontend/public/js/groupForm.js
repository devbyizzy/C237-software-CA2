document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('groupForm');
  if (!form) return;

  const formError = document.getElementById('formError');
  const deleteBtn = document.getElementById('deleteGroupBtn');
  const cancelLink = document.getElementById('cancelEditLink');

  // /groups/create → create mode; /groups/:id/edit → edit mode
  const pathParts = window.location.pathname.split('/');
  const isEdit = window.location.pathname.endsWith('/edit');
  const groupId = isEdit ? parseInt(pathParts[pathParts.length - 2], 10) : null;

  if (cancelLink && isEdit && groupId) {
    cancelLink.href = `/groups/${groupId}`;
  }

  if (isEdit && groupId) {
    loadGroupForEdit(groupId);
  }

  function currentUserId() {
    return window.CURRENT_USER && window.CURRENT_USER.userId ? window.CURRENT_USER.userId : null;
  }

  function showError(message) {
    formError.textContent = message;
    formError.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function loadGroupForEdit(id) {
    try {
      const params = currentUserId() ? `?user_id=${currentUserId()}` : '';
      const res = await fetch(`${window.API_BASE_URL}/api/groups/${id}${params}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || `API error: ${res.status}`);
      }
      const group = await res.json();

      if (group.viewer_role !== 'owner') {
        showError('Only the group owner can edit this group.');
        form.querySelector('button[type="submit"]').disabled = true;
        if (deleteBtn) deleteBtn.disabled = true;
        return;
      }

      document.getElementById('group_name').value = group.group_name || '';
      document.getElementById('group_type').value = group.group_type || '';
      document.getElementById('description').value = group.description || '';
      document.getElementById('privacy').value = group.privacy === 'private' ? 'private' : 'public';
      document.getElementById('diploma').value = group.diploma || '';
      document.getElementById('class_code').value = group.class_code || '';
      document.getElementById('module_code').value = group.module_code || '';
      document.getElementById('year_of_study').value = group.year_of_study || '';
      document.getElementById('semester').value = group.semester || '';
      document.getElementById('max_members').value = group.max_members || '';
    } catch (err) {
      console.error('Failed to load group:', err);
      showError(err.message || 'Failed to load this group. Make sure the backend server is running.');
    }
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    formError.style.display = 'none';

    if (!currentUserId()) {
      showError('Please log in first.');
      return;
    }

    const formData = new FormData(form);
    const payload = {
      user_id: currentUserId(),
      group_name: formData.get('group_name'),
      group_type: formData.get('group_type'),
      description: formData.get('description'),
      privacy: formData.get('privacy'),
      diploma: formData.get('diploma'),
      class_code: formData.get('class_code'),
      module_code: formData.get('module_code'),
      year_of_study: formData.get('year_of_study'),
      semester: formData.get('semester'),
      max_members: formData.get('max_members')
    };

    try {
      const url = isEdit && groupId
        ? `${window.API_BASE_URL}/api/groups/${groupId}/edit`
        : `${window.API_BASE_URL}/api/groups`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `API error: ${res.status}`);

      window.location.href = `/groups/${isEdit ? groupId : data.group_id}`;
    } catch (err) {
      console.error('Failed to save group:', err);
      showError(err.message || 'Failed to save the group. Make sure the backend server is running.');
    }
  });

  if (deleteBtn && isEdit && groupId) {
    deleteBtn.addEventListener('click', async function () {
      if (!confirm('Are you sure you want to delete this group? All members, posts and replies will be removed.')) {
        return;
      }

      try {
        const res = await fetch(`${window.API_BASE_URL}/api/groups/${groupId}/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: currentUserId() })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `API error: ${res.status}`);

        window.location.href = '/groups';
      } catch (err) {
        console.error('Failed to delete group:', err);
        showError(err.message || 'Failed to delete the group.');
      }
    });
  }
});
