import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../../services/api';
import { useTranslation } from '../../i18n';

const Login = ({ onLogin }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [errorDetails, setErrorDetails] = useState([]);
  const [loading, setLoading] = useState(false);

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
    setLoading(true);

    try {
      const response = await authAPI.login(formData);
      const { token, user } = response.data;

      // Initialiser le service de chiffrement si nécessaire
      // (la clé privée devrait être stockée côté client de manière sécurisée)
      
      onLogin(user, token);
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.details && Array.isArray(errorData.details)) {
        // Afficher les détails de validation
        setError(errorData.error || 'Erreur de validation');
        setErrorDetails(errorData.details.map(detail => detail.msg || detail.message));
      } else {
        setError(errorData?.error || t('auth.loginError'));
        setErrorDetails([]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>{t('auth.login')}</h1>
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
        <form onSubmit={handleSubmit}>
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
            />
          </div>
          <button type="submit" className="btn" disabled={loading}>
            {loading ? t('common.loading') : t('auth.login')}
          </button>
        </form>
        <div className="auth-link">
          {t('auth.noAccount')} <Link to="/register">{t('auth.register')}</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;

