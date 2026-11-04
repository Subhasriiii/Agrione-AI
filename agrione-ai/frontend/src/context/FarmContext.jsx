import React, { createContext, useContext, useState, useEffect } from 'react';
import { farmApi } from '../api/farmApi';
import { schemesApi } from '../api/schemesApi';
import { useAuth } from './AuthContext';

const FarmContext = createContext(null);

export const FarmProvider = ({ children }) => {
  const { user } = useAuth();
  const [farms, setFarms] = useState([]);
  const [activeFarm, setActiveFarm] = useState(null);
  const [loading, setLoading] = useState(false);
  const [farmError, setFarmError] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);

  const updateFarm = async (farmId, farmData) => {
    try {
      const res = await farmApi.updateFarm(farmId, farmData);
      const updatedFarm = res?.farm;

      if (!updatedFarm) {
        throw new Error('Farm update failed without a backend response');
      }

      setFarms((prev) => prev.map((farm) => (farm._id === farmId ? updatedFarm : farm)));
      setActiveFarm((prev) => (prev?._id === farmId ? updatedFarm : prev));

      return { success: true, farm: updatedFarm };
    } catch (error) {
      return { success: false, message: error.message || 'Unable to update farm' };
    }
  };

  useEffect(() => {
    const loadFarms = async () => {
      if (!user) {
        setFarms([]);
        setActiveFarm(null);
        setFarmError('');
        setNotifications([]);
        return;
      }

      setLoading(true);
      setFarmError('');
      try {
        const res = await farmApi.getFarms();
        const nextFarms = res?.farms;
        if (!Array.isArray(nextFarms)) {
          throw new Error('The farms endpoint returned an invalid response.');
        }
        setFarms(nextFarms);
        setActiveFarm(nextFarms[0] || null);
      } catch (error) {
        setFarmError(error.message || 'Unable to load farms. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadFarms();
  }, [user]);

  useEffect(() => {
    const loadNotifications = async () => {
      if (!user) {
        setNotifications([]);
        return;
      }

      try {
        const res = await schemesApi.getNotifications();
        if (res?.notifications && res.notifications.length > 0) {
          setNotifications(res.notifications);
        } else {
          setNotifications([]);
        }
      } catch (error) {
        setNotifications([]);
      }
    };

    loadNotifications();
  }, [user]);

  const addFarm = async (farmData) => {
    try {
      const res = await farmApi.createFarm(farmData);
      const newFarm = res?.farm;
      if (!newFarm) {
        throw new Error('Farm creation failed without a backend response');
      }

      setFarms((prev) => [newFarm, ...prev]);
      setActiveFarm(newFarm);
      setFarmError('');
      return { success: true, farm: newFarm };
    } catch (error) {
      const message = error.message || 'Unable to create farm. Please try again.';
      setFarmError(message);
      return { success: false, message };
    }
  };

  const updateSoil = async (farmId, soilData) => {
    try {
      const res = await farmApi.updateSoil(farmId, soilData);
      if (res?.success === false) {
        return { success: false, message: res.message || 'Unable to update soil data' };
      }

      const updatedFarm = res?.farm;
      setFarms((prev) =>
        prev.map((farm) => (farm._id === farmId ? { ...farm, soilData: updatedFarm?.soilData || { ...farm.soilData, ...soilData } } : farm))
      );
      if (activeFarm?._id === farmId) {
        setActiveFarm((prev) => ({
          ...prev,
          soilData: updatedFarm?.soilData || { ...prev.soilData, ...soilData },
        }));
      }
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message || 'Unable to update soil data' };
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await schemesApi.markAllRead();
    } catch (error) {
      // Intentionally no silent fallback; user will see unread count until backend updates.
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <FarmContext.Provider
      value={{
        farms,
        activeFarm,
        setActiveFarm,
        loading,
        farmError,
        addFarm,
        updateFarm,
        updateSoil,
        notifications,
        setNotifications,
        showNotificationDrawer,
        setShowNotificationDrawer,
        markAllNotificationsRead,
      }}
    >
      {children}
    </FarmContext.Provider>
  );
};

export const useFarm = () => useContext(FarmContext);
