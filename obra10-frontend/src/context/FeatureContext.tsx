import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import api from '../services/api';

interface FeatureContextType {
  features: string[];
  hasFeature: (code: string) => boolean;
  loading: boolean;
}

const FeatureContext = createContext<FeatureContextType>({
  features: [],
  hasFeature: () => false,
  loading: true,
});

export const FeatureProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [features, setFeatures] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      api.get('/features/minhas')
        .then(res => setFeatures(res.data))
        .catch(() => setFeatures([]))
        .finally(() => setLoading(false));
    } else {
      setFeatures([]);
      setLoading(false);
    }
  }, [user]);

  const hasFeature = (code: string) => features.includes(code);

  return (
    <FeatureContext.Provider value={{ features, hasFeature, loading }}>
      {children}
    </FeatureContext.Provider>
  );
};

export const useFeature = () => useContext(FeatureContext);
