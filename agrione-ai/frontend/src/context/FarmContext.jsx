import { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [notificationLoading, setNotificationLoading] = useState(true);
  const [notificationError, setNotificationError] = useState('');
  const [showNotificationDrawer, setShowNotificationDrawer] = useState(false);

  const refreshNotifications = useCallback(async () => {
    setNotificationLoading(true);
    setNotificationError('');
    try {
      const res = await schemesApi.getNotifications();
      if (
        res?.success !== true ||
        !Array.isArray(res.notifications) ||
        !Number.isInteger(res.unreadCount) ||
        res.unreadCount < 0 ||
        !res.notifications.every((notification) => typeof notification.isRead === 'boolean')
      ) {
        throw new Error(res?.message || 'The notifications service returned an unexpected response.');
      }

      setNotifications(res.notifications);
      setUnreadNotificationCount(res.unreadCount);
      return { success: true };
    } catch (error) {
      const message = error.message || 'Unable to load notifications.';
      setNotificationError(message);
      return { success: false, message };
    } finally {
      setNotificationLoading(false);
    }
  }, []);

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
        setUnreadNotificationCount(0);
        setNotificationError('');
        setNotificationLoading(false);
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
    let active = true;
    if (!user) {
      Promise.resolve().then(() => {
        if (!active) return;
        setNotifications([]);
        setUnreadNotificationCount(0);
        setNotificationError('');
        setNotificationLoading(false);
      });
      return () => {
        active = false;
      };
    }

    schemesApi.getNotifications().then((res) => {
      if (!active) return;
      if (
        res?.success !== true ||
        !Array.isArray(res.notifications) ||
        !Number.isInteger(res.unreadCount) ||
        res.unreadCount < 0 ||
        !res.notifications.every((notification) => typeof notification.isRead === 'boolean')
      ) {
        throw new Error(res?.message || 'The notifications service returned an unexpected response.');
      }

      setNotifications(res.notifications);
      setUnreadNotificationCount(res.unreadCount);
      setNotificationError('');
      setNotificationLoading(false);
    }).catch((error) => {
      if (!active) return;
      setNotificationError(error.message || 'Unable to load notifications.');
      setNotificationLoading(false);
    });

    return () => {
      active = false;
    };
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
      if (res?.success !== true || !res.farm?.soilData) {
        throw new Error(res?.message || 'Soil update failed without a farm response.');
      }

      const updatedFarm = res.farm;
      setFarms((prev) =>
        prev.map((farm) => (farm._id === farmId ? updatedFarm : farm))
      );
      if (activeFarm?._id === farmId) {
        setActiveFarm(updatedFarm);
      }
      return { success: true, farm: updatedFarm };
    } catch (error) {
      return { success: false, message: error.message || 'Unable to update soil data' };
    }
  };

  const deleteFarm = async (farmId) => {
    try {
      const res = await farmApi.deleteFarm(farmId);
      if (res?.success !== true) {
        throw new Error(res?.message || 'Unable to delete farm.');
      }

      const remainingFarms = farms.filter((farm) => farm._id !== farmId);
      setFarms((prev) => prev.filter((farm) => farm._id !== farmId));
      setActiveFarm((currentActiveFarm) => (
        currentActiveFarm?._id === farmId
          ? remainingFarms[0] || null
          : currentActiveFarm
      ));
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message || 'Unable to delete farm.' };
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      const res = await schemesApi.markAllRead();
      if (res?.success !== true) {
        throw new Error(res?.message || 'Unable to mark notifications as read.');
      }
      setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })));
      setUnreadNotificationCount(0);
      setNotificationError('');
      return { success: true };
    } catch (error) {
      const message = error.message || 'Unable to mark notifications as read.';
      setNotificationError(message);
      return { success: false, message };
    }
  };

  const markNotificationRead = async (notificationId) => {
    try {
      const res = await schemesApi.markRead(notificationId);
      if (res?.success !== true) {
        throw new Error(res?.message || 'Unable to mark notification as read.');
      }
      const wasUnread = notifications.some((notification) => notification._id === notificationId && notification.isRead === false);
      setNotifications((prev) =>
        prev.map((notification) => (
          notification._id === notificationId ? { ...notification, isRead: true } : notification
        ))
      );
      if (wasUnread) {
        setUnreadNotificationCount((count) => Math.max(0, count - 1));
      }
      setNotificationError('');
      return { success: true };
    } catch (error) {
      const message = error.message || 'Unable to mark notification as read.';
      setNotificationError(message);
      return { success: false, message };
    }
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
        deleteFarm,
        notifications,
        unreadNotificationCount,
        notificationLoading,
        notificationError,
        setNotificationError,
        refreshNotifications,
        showNotificationDrawer,
        setShowNotificationDrawer,
        markAllNotificationsRead,
        markNotificationRead,
      }}
    >
      {children}
    </FarmContext.Provider>
  );
};

export const useFarm = () => useContext(FarmContext);
