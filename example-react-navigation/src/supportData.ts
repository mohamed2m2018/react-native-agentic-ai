export type OrderTimelineEntry = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
};

export type DeviceSession = {
  id: string;
  deviceName: string;
  location: string;
  lastActive: string;
  isCurrentDevice: boolean;
  status: 'active' | 'revoked';
};

export type FraudInvestigationRecord = {
  id: string;
  accountId: string;
  status: 'locked' | 'reviewing' | 'cleared' | 'banned';
  lockReason: string;
  recentDevices: DeviceSession[];
  securityQuestions: Array<{
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
  }>;
  flaggedTransactions: Array<{
    id: string;
    amount: number;
    vendor: string;
    date: string;
  }>;
};

export type LogisticsDisputeRecord = {
  id: string;
  orderId: string;
  courierName: string;
  status: 'pending_user_action' | 'investigating' | 'resolved';
  deliveryCoordinates: { lat: number; lng: number };
  customerCoordinates: { lat: number; lng: number };
  gpsMatchStatus: 'match' | 'mismatch' | 'unknown';
  driverLogs: Array<{ time: string; action: string }>;
  resolutionOptions: Array<{ type: 'refund' | 'credit' | 'reorder'; value: number }>;
};


export type OrderRecord = {
  id: string;
  restaurant: string;
  status: string;
  placedAt: string;
  etaWindow: string;
  total: number;
  issueHeadline: string;
  issueSummary: string;
  courierStatus: string;
  itemCount: number;
  chargeId?: string;
  missingItem?: string;
  allergyNote?: string;
  timelines: OrderTimelineEntry[];
  items: Array<{ name: string; qty: number; price: number; note?: string }>;
};

export type ChargeRecord = {
  id: string;
  label: string;
  amount: number;
  status: string;
  issueHeadline: string;
  issueSummary: string;
  orderId?: string;
  breakdown: Array<{ label: string; amount: number }>;
};

export type SubscriptionRecord = {
  id: string;
  planName: string;
  status: string;
  monthlyPrice: number;
  renewedAt: string;
  nextRenewalAt: string;
  cancelState: string;
  issueHeadline: string;
  issueSummary: string;
};

export type DetailedSubscriptionRecord = SubscriptionRecord & {
  planTier: string;
  billingAnchor: string;
  paymentMethodLabel: string;
  backupPaymentLabel: string;
  workspaceSeats: number;
  monthlyUsageCap: number;
  smartRetryEnabled: boolean;
  invoiceConsolidationEnabled: boolean;
  autoApplyCredits: boolean;
  pauseScheduledFor?: string;
  pauseResumeOn?: string;
  managerEmail: string;
  cancellationRisk: 'low' | 'medium' | 'high';
  gracePeriodEndsAt: string;
  deliveryBoostsRemaining: number;
  benefits: string[];
  pendingChanges: string[];
};

export type SubscriptionPausePayload = {
  startDate: string;
  endDate: string;
  reason: string;
  seatFreezeCount: number;
  keepManagerAlerts: boolean;
  preservePromoPricing: boolean;
  pauseInvoices: boolean;
  internalNote: string;
};

export type SubscriptionCancellationPayload = {
  reason: string;
  detail: string;
  contactPreference: string;
  creditDisposition: string;
  acknowledgedLossOfBenefits: boolean;
};

export type LoyaltyEntry = {
  id: string;
  title: string;
  points: number;
  status: string;
  happenedAt: string;
  relatedOrderId?: string;
};

export type GiftRecord = {
  id: string;
  rewardName: string;
  recipientEmail: string;
  deliveryStatus: string;
  issueHeadline: string;
  issueSummary: string;
  sentAt: string;
};

export type NotificationAudit = {
  topLevelSmsPromos: boolean;
  channelLevelSmsPromos: boolean;
  lastMarketingTextAt: string;
  issueHeadline: string;
  issueSummary: string;
};

export type AccountSecurityRecord = {
  issueHeadline: string;
  issueSummary: string;
  passwordResetStatus: string;
  twoFactorState: string;
  rememberedDevice: string;
  lockReason: string;
  lastFailedLoginAt: string;
};

const orders: OrderRecord[] = [
  {
    id: 'ord_1001',
    restaurant: 'Basil & Brick',
    status: 'In progress',
    placedAt: '12:08 PM',
    etaWindow: '12:40 PM - 12:50 PM',
    total: 34.87,
    issueHeadline: 'Late order with courier delay',
    issueSummary:
      'The restaurant finished prep on time, but the courier has been stalled near downtown for 52 minutes.',
    courierStatus: 'Latest courier update at 12:54 PM',
    itemCount: 3,
    chargeId: 'ch_2001',
    timelines: [
      {
        id: 't1',
        title: 'Order placed',
        detail: 'Payment authorized and order sent to restaurant.',
        timestamp: '12:08 PM',
      },
      {
        id: 't2',
        title: 'Restaurant accepted',
        detail: 'Basil & Brick confirmed the order within 2 minutes.',
        timestamp: '12:10 PM',
      },
      {
        id: 't3',
        title: 'Ready for pickup',
        detail: 'Kitchen marked the order ready on schedule.',
        timestamp: '12:31 PM',
      },
      {
        id: 't4',
        title: 'Driver update',
        detail:
          'Courier accepted another stop before heading to the pickup route.',
        timestamp: '12:54 PM',
      },
    ],
    items: [
      { name: 'Roasted Chicken Pizza', qty: 1, price: 18.5 },
      { name: 'Garlic Knots', qty: 1, price: 6.5 },
      { name: 'Blood Orange Spritz', qty: 1, price: 5.99 },
    ],
  },
  {
    id: 'ord_1002',
    restaurant: 'Golden Curry House',
    status: 'Delivered',
    placedAt: 'Yesterday, 7:14 PM',
    etaWindow: '7:35 PM - 7:50 PM',
    total: 28.15,
    issueHeadline: 'Missing item after delivery',
    issueSummary:
      'The order was delivered, but the mango lassi never arrived even though it appears on the receipt.',
    courierStatus: 'Drop-off completed',
    itemCount: 4,
    missingItem: 'Mango Lassi',
    timelines: [
      {
        id: 't5',
        title: 'Delivered',
        detail: 'Driver photo confirms the bag was dropped off.',
        timestamp: '7:47 PM',
      },
    ],
    items: [
      { name: 'Butter Chicken', qty: 1, price: 14.5 },
      { name: 'Garlic Naan', qty: 1, price: 3.75 },
      { name: 'Samosa Trio', qty: 1, price: 5.5 },
      { name: 'Mango Lassi', qty: 1, price: 4.4 },
    ],
  },
  {
    id: 'ord_1003',
    restaurant: 'Burger Foundry',
    status: 'Completed',
    placedAt: 'Mar 30, 8:03 PM',
    etaWindow: '8:20 PM - 8:30 PM',
    total: 32.99,
    issueHeadline: 'Overcharged receipt',
    issueSummary:
      'The final charge includes a duplicate delivery fee even though the order qualified for free delivery.',
    courierStatus: 'Receipt available',
    itemCount: 2,
    chargeId: 'ch_2002',
    timelines: [
      {
        id: 't6',
        title: 'Promo applied',
        detail: 'Free delivery promo attached at checkout.',
        timestamp: '8:04 PM',
      },
      {
        id: 't7',
        title: 'Delivered',
        detail: 'Order completed successfully.',
        timestamp: '8:27 PM',
      },
    ],
    items: [
      { name: 'Classic Smash', qty: 2, price: 13.5 },
      { name: 'House Fries', qty: 1, price: 5.99 },
    ],
  },
  {
    id: 'ord_1004',
    restaurant: 'Green Bowl Co.',
    status: 'Completed',
    placedAt: 'Mar 29, 1:06 PM',
    etaWindow: '1:20 PM - 1:35 PM',
    total: 22.5,
    issueHeadline: 'Allergy or dietary note ignored',
    issueSummary:
      'The order note requested no peanuts, but the delivered bowl included satay sauce.',
    courierStatus: 'Receipt available',
    itemCount: 1,
    allergyNote:
      'Peanut allergy. Please skip satay sauce and mark bag clearly.',
    timelines: [
      {
        id: 't8',
        title: 'Special instructions sent',
        detail: 'Peanut allergy note was attached to the order.',
        timestamp: '1:07 PM',
      },
      {
        id: 't9',
        title: 'Delivered',
        detail: 'Customer reported satay sauce included despite note.',
        timestamp: '1:31 PM',
      },
    ],
    items: [
      {
        name: 'Protein Green Bowl',
        qty: 1,
        price: 22.5,
        note: 'Peanut allergy. Please skip satay sauce.',
      },
    ],
  },
];

const charges: ChargeRecord[] = [
  {
    id: 'ch_2001',
    label: 'Order payment',
    amount: 34.87,
    status: 'Captured',
    issueHeadline: 'Late delivery, fee may be refundable after 45 minutes',
    issueSummary:
      'Charge is valid, but policy may allow a delivery-fee credit because the courier delay exceeded 45 minutes.',
    orderId: 'ord_1001',
    breakdown: [
      { label: 'Food subtotal', amount: 24.49 },
      { label: 'Service fee', amount: 3.49 },
      { label: 'Delivery fee', amount: 2.99 },
      { label: 'Tip', amount: 3.9 },
    ],
  },
  {
    id: 'ch_2002',
    label: 'Order payment',
    amount: 32.99,
    status: 'Captured',
    issueHeadline: 'Overcharge linked to free-delivery promo',
    issueSummary:
      'The receipt still charged two delivery-line items even though the promo reduced delivery to $0.',
    orderId: 'ord_1003',
    breakdown: [
      { label: 'Food subtotal', amount: 32.99 },
      { label: 'Delivery fee', amount: 2.99 },
      { label: 'Delivery fee (duplicate)', amount: 2.99 },
      { label: 'Promo credit', amount: -2.99 },
    ],
  },
  {
    id: 'ch_2003',
    label: 'Subscription renewal',
    amount: 19.99,
    status: 'Captured',
    issueHeadline: 'Cancellation still billed',
    issueSummary:
      'The subscription was marked cancel-at-period-end, but a renewal charge still posted yesterday.',
    breakdown: [{ label: 'Premium+ monthly renewal', amount: 19.99 }],
  },
];

const subscriptions: DetailedSubscriptionRecord[] = [
  {
    id: 'sub_3001',
    planName: 'Premium+',
    status: 'Active',
    monthlyPrice: 19.99,
    renewedAt: 'Mar 31, 9:02 AM',
    nextRenewalAt: 'Apr 30, 9:02 AM',
    cancelState: 'Auto-renew on',
    issueHeadline: 'Subscription renewed unexpectedly',
    issueSummary:
      'The customer says they did not mean to keep the plan after the trial ended yesterday.',
    planTier: 'Growth workspace',
    billingAnchor: '30th of each month · 9:02 AM',
    paymentMethodLabel: 'Visa •••• 4242',
    backupPaymentLabel: 'PayPal Backup Wallet',
    workspaceSeats: 6,
    monthlyUsageCap: 1200,
    smartRetryEnabled: true,
    invoiceConsolidationEnabled: false,
    autoApplyCredits: true,
    managerEmail: 'ops@foodapp-demo.com',
    cancellationRisk: 'medium',
    gracePeriodEndsAt: 'May 3, 2026',
    deliveryBoostsRemaining: 4,
    benefits: ['Priority support', 'Free delivery boosts', 'Family billing controls'],
    pendingChanges: ['Trial converted to paid yesterday', 'Smart retry is active for failed renewals'],
  },
  {
    id: 'sub_3002',
    planName: 'Family Delivery Pass',
    status: 'Cancel pending at period end',
    monthlyPrice: 24.99,
    renewedAt: 'Mar 31, 11:18 AM',
    nextRenewalAt: 'May 1, 11:18 AM',
    cancelState: 'Ends at next billing date',
    issueHeadline: 'Cancellation still billed',
    issueSummary:
      'Cancellation was requested, but a fresh renewal charge posted before the period ended.',
    planTier: 'Family workspace',
    billingAnchor: '1st of each month · 11:18 AM',
    paymentMethodLabel: 'Mastercard •••• 8820',
    backupPaymentLabel: 'No backup payment set',
    workspaceSeats: 10,
    monthlyUsageCap: 2400,
    smartRetryEnabled: false,
    invoiceConsolidationEnabled: true,
    autoApplyCredits: false,
    pauseScheduledFor: 'Apr 12, 2026',
    pauseResumeOn: 'May 10, 2026',
    managerEmail: 'family-admin@foodapp-demo.com',
    cancellationRisk: 'high',
    gracePeriodEndsAt: 'May 5, 2026',
    deliveryBoostsRemaining: 9,
    benefits: ['Shared household billing', 'Extended refund review', 'Pause windows up to 60 days'],
    pendingChanges: ['Pause window already queued for next cycle', 'Family member seat cap is almost full'],
  },
];

const loyaltyEntries: LoyaltyEntry[] = [
  {
    id: 'loy_1',
    title: 'Order earn from ord_1001',
    points: 35,
    status: 'Posted',
    happenedAt: 'Today, 12:09 PM',
    relatedOrderId: 'ord_1001',
  },
  {
    id: 'loy_2',
    title: 'Review bonus for Roasted Chicken Pizza',
    points: 50,
    status: 'Pending sync',
    happenedAt: 'Mar 31, 6:20 PM',
    relatedOrderId: 'ord_1004',
  },
  {
    id: 'loy_3',
    title: 'Gift-card redemption',
    points: -120,
    status: 'Posted',
    happenedAt: 'Mar 30, 10:05 AM',
  },
];

const gifts: GiftRecord[] = [
  {
    id: 'gift_5001',
    rewardName: '$10 Lunch Gift',
    recipientEmail: 'freind@example.com',
    deliveryStatus: 'Delivery failed',
    issueHeadline: 'Gift card sent but recipient never received it',
    issueSummary:
      'The recipient email appears mistyped, and the gift delivery bounced after the send attempt.',
    sentAt: 'Mar 30, 10:06 AM',
  },
];

const notificationAudit: NotificationAudit = {
  topLevelSmsPromos: false,
  channelLevelSmsPromos: true,
  lastMarketingTextAt: 'Today, 9:12 AM',
  issueHeadline: 'Notification opt-out mismatch',
  issueSummary:
    'The Settings screen says SMS promos are off, but the channel-level preference still shows them as enabled.',
};

const accountSecurity: AccountSecurityRecord = {
  issueHeadline: 'Account recovery and 2FA friction',
  issueSummary:
    'Password reset email was sent, but the account remains challenged because the remembered device token expired.',
  passwordResetStatus: 'Reset email sent 18 minutes ago',
  twoFactorState: 'Enabled, but remembered device token expired',
  rememberedDevice: 'iPhone 16e · last trusted 29 days ago',
  lockReason: 'Too many sign-in attempts from a new device',
  lastFailedLoginAt: 'Today, 8:41 AM',
};

function delay<T>(value: T, ms: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export async function fetchOrders(): Promise<OrderRecord[]> {
  return delay(orders, 900);
}

export async function fetchOrder(
  orderId: string
): Promise<OrderRecord | undefined> {
  return delay(
    orders.find((order) => order.id === orderId),
    1200
  );
}

export async function fetchCharges(): Promise<ChargeRecord[]> {
  return delay(charges, 1000);
}

export async function fetchCharge(
  chargeId: string
): Promise<ChargeRecord | undefined> {
  return delay(
    charges.find((charge) => charge.id === chargeId),
    1300
  );
}

export async function fetchSubscriptions(): Promise<SubscriptionRecord[]> {
  return delay(subscriptions.map(toSubscriptionSummary), 1500);
}

export async function fetchSubscription(
  subscriptionId: string
): Promise<DetailedSubscriptionRecord | undefined> {
  return delay(
    subscriptions.find((subscription) => subscription.id === subscriptionId),
    900
  );
}

export async function updateSubscriptionControls(
  subscriptionId: string,
  patch: Partial<
    Pick<
      DetailedSubscriptionRecord,
      | 'managerEmail'
      | 'workspaceSeats'
      | 'monthlyUsageCap'
      | 'smartRetryEnabled'
      | 'invoiceConsolidationEnabled'
      | 'autoApplyCredits'
      | 'billingAnchor'
      | 'backupPaymentLabel'
    >
  >
): Promise<DetailedSubscriptionRecord | undefined> {
  const subscription = subscriptions.find((item) => item.id === subscriptionId);
  if (!subscription) return delay(undefined, 800);

  Object.assign(subscription, patch);
  subscription.pendingChanges = [
    'Workspace controls updated moments ago',
    ...subscription.pendingChanges.filter((entry) => entry !== 'Workspace controls updated moments ago'),
  ].slice(0, 3);

  return delay(subscription, 800);
}

export async function scheduleSubscriptionPause(
  subscriptionId: string,
  payload: SubscriptionPausePayload
): Promise<DetailedSubscriptionRecord | undefined> {
  const subscription = subscriptions.find((item) => item.id === subscriptionId);
  if (!subscription) return delay(undefined, 900);

  subscription.pauseScheduledFor = payload.startDate;
  subscription.pauseResumeOn = payload.endDate;
  subscription.cancelState = `Pause scheduled ${payload.startDate} → ${payload.endDate}`;
  subscription.pendingChanges = [
    `Pause queued for ${payload.reason.toLowerCase()}`,
    payload.pauseInvoices ? 'Invoices will be held during pause' : 'Invoices continue during pause',
    payload.preservePromoPricing ? 'Promo pricing preserved for resume' : 'Promo pricing will be recalculated on resume',
  ];

  return delay(subscription, 900);
}

export async function submitSubscriptionCancellation(
  subscriptionId: string,
  payload: SubscriptionCancellationPayload
): Promise<DetailedSubscriptionRecord | undefined> {
  const subscription = subscriptions.find((item) => item.id === subscriptionId);
  if (!subscription) return delay(undefined, 1100);

  subscription.status = 'Cancellation review open';
  subscription.cancelState = `Cancellation requested · ${payload.reason}`;
  subscription.pendingChanges = [
    `Retention specialist requested via ${payload.contactPreference.toLowerCase()}`,
    payload.creditDisposition,
    payload.detail || 'No extra cancellation detail submitted',
  ];

  return delay(subscription, 1100);
}

export async function fetchLoyaltyActivity(): Promise<LoyaltyEntry[]> {
  return delay(loyaltyEntries, 1200);
}

export async function fetchGiftHistory(): Promise<GiftRecord[]> {
  return delay(gifts, 1000);
}

export async function fetchGift(
  giftId: string
): Promise<GiftRecord | undefined> {
  return delay(
    gifts.find((gift) => gift.id === giftId),
    1100
  );
}

export async function fetchNotificationAudit(): Promise<NotificationAudit> {
  return delay(notificationAudit, 900);
}

export async function fetchAccountSecurity(): Promise<AccountSecurityRecord> {
  return delay(accountSecurity, 1400);
}

function toSubscriptionSummary(
  subscription: DetailedSubscriptionRecord
): SubscriptionRecord {
  return {
    id: subscription.id,
    planName: subscription.planName,
    status: subscription.status,
    monthlyPrice: subscription.monthlyPrice,
    renewedAt: subscription.renewedAt,
    nextRenewalAt: subscription.nextRenewalAt,
    cancelState: subscription.cancelState,
    issueHeadline: subscription.issueHeadline,
    issueSummary: subscription.issueSummary,
  };
}

const mockFraudRecord: FraudInvestigationRecord = {
  id: 'fraud_9001',
  accountId: 'usr_abc123',
  status: 'locked',
  lockReason: 'Suspicious login attempt from unauthorized location',
  recentDevices: [
    { id: 'dev_1', deviceName: 'iPhone 15 Pro', location: 'New York, NY', lastActive: 'Currently Active', isCurrentDevice: true, status: 'active' },
    { id: 'dev_2', deviceName: 'Chrome on Windows 11', location: 'Moscow, RU', lastActive: '2 hours ago', isCurrentDevice: false, status: 'active' },
    { id: 'dev_3', deviceName: 'Safari on macOS', location: 'New York, NY', lastActive: '5 days ago', isCurrentDevice: false, status: 'active' },
  ],
  securityQuestions: [
    {
      id: 'sq_1',
      question: 'Which of the following restaurants have you ordered from in the last 30 days?',
      options: ['Golden Curry House', 'Sushi Zen', 'Taco Fiesta', 'Pasta Bella'],
      correctIndex: 0,
    },
    {
      id: 'sq_2',
      question: 'Identify the last four digits of the credit card linked to your Family Workspace:',
      options: ['1234', '8820', '9911', '4242'],
      correctIndex: 1,
    }
  ],
  flaggedTransactions: [
    { id: 'tx_88', amount: 350.00, vendor: 'High-End Steakhouse', date: '2 hours ago' },
    { id: 'tx_89', amount: 120.50, vendor: 'Liquor Depot', date: '1 hour ago' }
  ]
};

const mockLogisticsRecord: LogisticsDisputeRecord = {
  id: 'log_8001',
  orderId: 'ord_1002', // Links to the delivered order missing Mango Lassi
  courierName: 'Alex D.',
  status: 'pending_user_action',
  deliveryCoordinates: { lat: 40.7128, lng: -74.0060 },
  customerCoordinates: { lat: 40.7135, lng: -74.0055 },
  gpsMatchStatus: 'mismatch',
  driverLogs: [
    { time: '7:15 PM', action: 'Assigned to order' },
    { time: '7:30 PM', action: 'Arrived at pickup' },
    { time: '7:32 PM', action: 'Left pickup, heading to dropoff' },
    { time: '7:45 PM', action: 'Approaching geo-fence' },
    { time: '7:47 PM', action: 'Marked delivered with photo' }
  ],
  resolutionOptions: [
    { type: 'refund', value: 28.15 },
    { type: 'credit', value: 35.00 },
    { type: 'reorder', value: 0 }
  ]
};

export async function fetchFraudInvestigation(accountId: string): Promise<FraudInvestigationRecord> {
  return delay(mockFraudRecord, 1100);
}

export async function fetchLogisticsDispute(disputeId: string): Promise<LogisticsDisputeRecord> {
  return delay(mockLogisticsRecord, 900);
}

