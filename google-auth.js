// google-auth.js - Servicio de autenticación con Google
const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');

class GoogleAuthService {
    constructor() {
        this.clientId = process.env.GOOGLE_CLIENT_ID;
        this.clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        this.redirectUri = process.env.GOOGLE_REDIRECT_URI;
        
        if (!this.clientId || !this.clientSecret) {
            console.warn('⚠️ Google OAuth no configurado correctamente');
        }
        
        this.oauthClient = new OAuth2Client(
            this.clientId,
            this.clientSecret,
            this.redirectUri
        );
        
        // Almacenamiento temporal de estados OAuth
        this.oauthStates = new Map();
        // Almacenamiento de sesiones de usuario
        this.userSessions = new Map();
    }

    getAuthUrl() {
        const state = crypto.randomBytes(32).toString('hex');
        const nonce = crypto.randomBytes(16).toString('hex');
        
        this.oauthStates.set(state, { nonce, timestamp: Date.now() });
        this._cleanOldStates();
        
        const authUrl = this.oauthClient.generateAuthUrl({
            access_type: 'offline',
            scope: [
                'https://www.googleapis.com/auth/userinfo.email',
                'https://www.googleapis.com/auth/userinfo.profile',
                'openid'
            ],
            state: state,
            nonce: nonce,
            prompt: 'select_account'
        });
        
        return authUrl;
    }

    async verifyAuthCode(code, state) {
        const stateData = this.oauthStates.get(state);
        if (!stateData) {
            throw new Error('Estado OAuth inválido o expirado');
        }
        
        this.oauthStates.delete(state);
        
        const { tokens } = await this.oauthClient.getToken(code);
        
        const ticket = await this.oauthClient.verifyIdToken({
            idToken: tokens.id_token,
            audience: this.clientId
        });
        
        const payload = ticket.getPayload();
        
        const userData = {
            id: payload.sub,
            email: payload.email,
            nombre: payload.name || payload.given_name || 'Usuario',
            avatar: payload.picture || null,
            email_verified: payload.email_verified || false,
            verificado: payload.email_verified || false,
            fecha_registro: new Date().toISOString(),
            bloqueado: false,
            motivo_bloqueo: null,
            provider: 'google'
        };
        
        const sessionToken = crypto.randomBytes(64).toString('hex');
        this.userSessions.set(sessionToken, {
            ...userData,
            createdAt: Date.now(),
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
        });
        
        this._cleanOldSessions();
        
        return {
            token: sessionToken,
            usuario: userData
        };
    }

    verifySession(token) {
        const session = this.userSessions.get(token);
        if (!session) return null;
        
        if (session.expiresAt < Date.now()) {
            this.userSessions.delete(token);
            return null;
        }
        
        const { createdAt, expiresAt, ...userData } = session;
        return userData;
    }

    revokeSession(token) {
        return this.userSessions.delete(token);
    }

    getUserByEmail(email) {
        for (const [token, session] of this.userSessions) {
            if (session.email === email && session.expiresAt > Date.now()) {
                const { createdAt, expiresAt, ...userData } = session;
                return userData;
            }
        }
        return null;
    }

    _cleanOldStates() {
        const now = Date.now();
        for (const [state, data] of this.oauthStates) {
            if (now - data.timestamp > 5 * 60 * 1000) {
                this.oauthStates.delete(state);
            }
        }
    }

    _cleanOldSessions() {
        const now = Date.now();
        for (const [token, session] of this.userSessions) {
            if (session.expiresAt < now) {
                this.userSessions.delete(token);
            }
        }
    }
}

module.exports = GoogleAuthService;