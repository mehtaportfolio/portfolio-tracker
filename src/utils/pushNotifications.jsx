import { BACKEND_URL } from "../config/apiConfig.js";
const VAPID_PUBLIC_KEY = 'BAQJtI7Zn1qaMSDOJSfAoTjyR1QPuqXyBBtBtPc01xptaVPSvpoEhOj2Gxm6yxIn1NC3khtRPWJUe8FB68zGshs';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeToNotifications(profitThreshold = "5") {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push notifications are not supported in this browser.');
    return false;
  }

  try {
    // Check if service worker is registered first
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      console.log('Service worker not registered. Push notifications require a production build or local SSL with registered SW.');
      throw new Error('SERVICE_WORKER_MISSING');
    }
    
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied.');
      return false;
    }

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    // Always re-subscribe to ensure the backend has the latest endpoint/keys
    // and to handle expired subscriptions
    const subscribeOptions = {
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    };
    subscription = await registration.pushManager.subscribe(subscribeOptions);

    // Send subscription to backend
    const backendUrl = BACKEND_URL;
    const response = await fetch(`${backendUrl}/api/notifications/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        subscription,
        profitThreshold: parseFloat(profitThreshold)
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send subscription to backend');
    }

    console.log('Successfully subscribed to push notifications');
    return true;
  } catch (error) {
    console.error('Error subscribing to push notifications:', error);
    throw error; // Re-throw so Profile.js can handle specific errors
  }
}

export async function unsubscribeFromNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      
      // Notify backend to remove subscription
      const backendUrl = BACKEND_URL;
      await fetch(`${backendUrl}/api/notifications/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
    }
    
    console.log('Successfully unsubscribed from push notifications');
    return true;
  } catch (error) {
    console.error('Error unsubscribing from push notifications:', error);
    return false;
  }
}

export async function checkNotificationStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    
    if (isIOS && !isStandalone) {
      console.log('Push notifications on iOS require "Add to Home Screen" (PWA)');
      return 'ios_not_pwa';
    }
    
    console.log('Push notifications not supported: SW in navigator:', 'serviceWorker' in navigator, 'PushManager in window:', 'PushManager' in window);
    return 'unsupported';
  }
  
  if (Notification.permission === 'granted') {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return subscription ? 'subscribed' : 'granted';
  }
  
  return Notification.permission;
}
