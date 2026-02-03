import jwt from 'jsonwebtoken';
export const authenticateJWT = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader) {
        const token = authHeader.split(' ')[1]; // Bearer <token>
        jwt.verify(token, process.env.JWT_SECRET || 'dev_secret_only', (err, user) => {
            if (err) {
                return res.status(403).json({ error: 'FORBIDDEN: Invalid Token' });
            }
            // Transform payload to req.user
            req.user = {
                uuid: user.user_uuid,
                role: user.role
            };
            next();
        });
    }
    else {
        res.status(401).json({ error: 'UNAUTHORIZED: Missing Token' });
    }
};
