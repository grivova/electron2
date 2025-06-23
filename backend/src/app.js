require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { connectDB } = require('./config/db');
const employeeRoutes = require('./routes/employee');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/employee', employeeRoutes);

// Test route
app.get('/api/test', (req, res) => {
    res.json({ message: 'API работает' });
});

// Database connection
connectDB();

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
}); 