const jwt = require('jsonwebtoken');
require('dotenv').config();

const userPayload = {username: 'testUser'};
const token = jwt.sign(userPayload, process.env.JWT_SECRET, {expiresIn: '1h'});
console.log('JWT Token:', token);
