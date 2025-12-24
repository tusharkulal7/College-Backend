const { createUser, listUsers, getUser, updateUser, deleteUser } = require('./user.service');
const { createSchema, updateSchema } = require('./user.validation');

async function create(req, res) {
  const { error, value } = createSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  try {
    const doc = await createUser(value);
    res.status(201).json(doc);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: err.message });
  }
}

async function list(req, res) {
  const { limit, skip, active, q } = req.query;
  try {
    const docs = await listUsers({
      limit: limit ? Number(limit) : undefined,
      skip: skip ? Number(skip) : undefined,
      active: active === 'true' ? true : active === 'false' ? false : undefined,
      q
    });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function getById(req, res) {
  try {
    const doc = await getUser(req.params.id);
    if (!doc) return res.status(404).json({ message: 'User not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function update(req, res) {
  const { error, value } = updateSchema.validate(req.body);
  if (error) return res.status(400).json({ message: error.message });
  try {
    const doc = await updateUser(req.params.id, value);
    if (!doc) return res.status(404).json({ message: 'User not found' });
    res.json(doc);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: err.message });
  }
}

async function remove(req, res) {
  try {
    const doc = await deleteUser(req.params.id);
    if (!doc) return res.status(404).json({ message: 'User not found' });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

module.exports = { create, list, getById, update, remove };