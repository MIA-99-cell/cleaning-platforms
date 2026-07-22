import api from '../services/api';
import toast from 'react-hot-toast';

export const FLUTTERWAVE_NETWORKS = [
  { value: 'MTN', label: 'MTN Mobile Money' },
  { value: 'ORANGE', label: 'Orange Money' },
];

export const handleFlutterwaveResponse = (data) => {
  const nextAction = data?.next_action;
  if (!nextAction) return;

  if (nextAction.type === 'redirect_url' && nextAction.redirect_url?.url) {
    window.location.href = nextAction.redirect_url.url;
    return;
  }

  if (nextAction.type === 'payment_instruction') {
    const note = nextAction.payment_instruction?.note
      || 'Check your phone and approve the Mobile Money payment prompt.';
    toast.success(note, { duration: 8000 });
    return;
  }

  toast.success('Payment initiated. Please complete it on your phone.');
};

export const initiateBookingFlutterwave = async ({
  bookingId,
  phone,
  network,
  contactEmail,
  isGuest = true,
}) => {
  const payload = {
    booking_id: bookingId,
    phone,
    network,
    contact_email: contactEmail,
    email: contactEmail,
  };
  const url = isGuest
    ? '/public/flutterwave/initiate/booking'
    : '/payments/flutterwave/initiate/booking';
  const res = await api.post(url, payload);
  return res.data?.data;
};

export const initiateProductOrderFlutterwave = async ({
  orderGroupId,
  phone,
  network,
  contactEmail,
  isGuest = true,
}) => {
  const payload = {
    order_group_id: orderGroupId,
    phone,
    network,
    contact_email: contactEmail,
    email: contactEmail,
  };
  const url = isGuest
    ? '/public/flutterwave/initiate/product-order'
    : '/payments/flutterwave/initiate/product-order';
  const res = await api.post(url, payload);
  return res.data?.data;
};

export const verifyFlutterwavePayment = async (reference) => {
  const res = await api.get(`/payments/flutterwave/verify/${encodeURIComponent(reference)}`);
  return res.data?.data;
};
