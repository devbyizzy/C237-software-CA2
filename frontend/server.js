const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5173;

app.use(express.static(path.join(__dirname)));

app.listen(PORT, () => {
  console.log(`RPConnect frontend running at http://localhost:${PORT}`);
});
