import { useState, useEffect } from 'react';

// Shared checkout form state for the product and cart checkout modals.
export const useCheckoutForm = (user) => {
  const [paymentMethod, setPaymentMethod] = useState('flutterwave');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [network, setNetwork] = useState('MTN');
  const [transactionRef, setTransactionRef] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.email) setContactEmail(user.email);
  }, [user?.email]);

  return {
    paymentMethod, setPaymentMethod,
    deliveryAddress, setDeliveryAddress,
    deliveryPhone, setDeliveryPhone,
    contactEmail, setContactEmail,
    network, setNetwork,
    transactionRef, setTransactionRef,
    notes, setNotes,
    loading, setLoading,
  };
};
