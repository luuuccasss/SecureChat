import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import cryptoSession from '../../crypto/session';
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

    // The server never sees the password, so its rules are enforced here
    if (formData.password !== formData.confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    if (formData.password.length < 10 || !/[a-z]/.test(formData.password) ||
        !/[A-Z]/.test(formData.password) || !/\d/.test(formData.password)) {
      setError(t('auth.passwordRules'));
      return;
    }

    setLoading(true);

    try {
      // Derives the keys from the password and creates the encryption identity
      const { token, user } = await cryptoSession.register({
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });
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
        {loading && (
          <div className="success-message">
            {t('auth.generatingKeys')}
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
              minLength={10}
              autoComplete="new-password"
            />
            <small className="form-hint">{t('auth.passwordRules')}</small>
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
          <button type="submit" className="btn" disabled={loading}>
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

