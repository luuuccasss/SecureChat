import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../../services/api';
import cryptoService from '../../crypto/cryptoService';
import { useTranslation } from '../../i18n';

const Register = ({ onLogin }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generatingKeys, setGeneratingKeys] = useState(false);

  useEffect(() => {
    // Générer les clés au chargement du composant
    generateKeys();
  }, []);

  const generateKeys = async () => {
    try {
      setGeneratingKeys(true);
      await cryptoService.generateKeyPair();
      setGeneratingKeys(false);
    } catch (err) {
      console.error('Erreur lors de la génération des clés:', err);
      setError('Erreur lors de la génération des clés de chiffrement');
      setGeneratingKeys(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setErrorDetails([]);

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError(t('errors.validation'));
      return;
    }

    if (formData.password.length < 8) {
      setError(t('errors.validation'));
      return;
    }

    if (!cryptoService.getPublicKey()) {
      setError(t('common.loading'));
      return;
    }

    setLoading(true);

    try {
      const publicKey = cryptoService.getPublicKey();
      
      const response = await authAPI.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        publicKey: publicKey,
      });

      const { token, user } = response.data;

      // Stocker la clé privée de manière sécurisée (en production, utiliser un stockage plus sûr)
      // Pour cette démo, on la stocke dans localStorage (non recommandé en production)
      const privateKey = cryptoService.privateKeyPem;
      localStorage.setItem('privateKey', privateKey);

      onLogin(user, token);
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.details && Array.isArray(errorData.details)) {
        // Afficher les détails de validation
        setError(errorData.error || 'Erreur de validation');
        setErrorDetails(errorData.details.map(detail => detail.msg || detail.message));
      } else {
        setError(errorData?.error || 'Erreur lors de l\'inscription');
        setErrorDetails([]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>{t('auth.register')}</h1>
        {error && (
          <div className="error-message">
            <strong>{error}</strong>
            {errorDetails.length > 0 && (
              <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
                {errorDetails.map((detail, index) => (
                  <li key={index}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {generatingKeys && (
          <div className="success-message">
            {t('common.loading')}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">{t('auth.username')}</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_-]+"
            />
          </div>
          <div className="form-group">
            <label htmlFor="email">{t('auth.email')}</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">{t('auth.password')}</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={8}
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">{t('auth.confirmPassword')}</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>
          <button type="submit" className="btn" disabled={loading || generatingKeys}>
            {loading ? t('common.loading') : t('auth.register')}
          </button>
        </form>
        <div className="auth-link">
          {t('auth.alreadyHaveAccount')} <Link to="/login">{t('auth.login')}</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;

