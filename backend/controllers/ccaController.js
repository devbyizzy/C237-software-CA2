const { ccas } = require('../data/sampleData');

exports.getAllCcas = (req, res) => {
  const search = String(req.query.search || '').trim().toLowerCase();
  const category = String(req.query.category || '').trim();

  let results = [...ccas];

  if (search) {
    results = results.filter(c => c.cca_name.toLowerCase().includes(search));
  }

  if (category) {
    results = results.filter(c => c.category === category);
  }

  res.json({ count: results.length, results });
};

exports.getCcaById = (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid CCA id' });
  }

  const cca = ccas.find(c => c.cca_id === id);
  if (!cca) {
    return res.status(404).json({ error: 'CCA not found' });
  }

  res.json(cca);
};

exports.createCca = (req, res) => {
  const { cca_name, category, description, training_day, training_time, location, contact_information, image } = req.body || {};

  if (!cca_name || !cca_name.trim()) {
    return res.status(400).json({ error: 'cca_name is required' });
  }
  if (!category || !category.trim()) {
    return res.status(400).json({ error: 'category is required' });
  }

  const maxId = ccas.reduce((max, c) => Math.max(max, c.cca_id), 0);

  const newCca = {
    cca_id: maxId + 1,
    cca_name: cca_name.trim(),
    category: category.trim(),
    description: (description || '').trim(),
    training_day: (training_day || '').trim(),
    training_time: (training_time || '').trim(),
    location: (location || '').trim(),
    contact_information: (contact_information || '').trim(),
    image: (image || '').trim(),
    created_at: new Date().toISOString()
  };

  ccas.push(newCca);

  res.status(201).json(newCca);
};

exports.updateCca = (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid CCA id' });
  }

  const cca = ccas.find(c => c.cca_id === id);
  if (!cca) {
    return res.status(404).json({ error: 'CCA not found' });
  }

  const { cca_name, category, description, training_day, training_time, location, contact_information, image } = req.body || {};

  if (cca_name !== undefined) cca.cca_name = cca_name.trim();
  if (category !== undefined) cca.category = category.trim();
  if (description !== undefined) cca.description = description.trim();
  if (training_day !== undefined) cca.training_day = training_day.trim();
  if (training_time !== undefined) cca.training_time = training_time.trim();
  if (location !== undefined) cca.location = location.trim();
  if (contact_information !== undefined) cca.contact_information = contact_information.trim();
  if (image !== undefined) cca.image = image.trim();

  res.json(cca);
};

exports.deleteCca = (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return res.status(400).json({ error: 'Invalid CCA id' });
  }

  const index = ccas.findIndex(c => c.cca_id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'CCA not found' });
  }

  ccas.splice(index, 1);

  res.json({ message: 'CCA deleted successfully' });
};

