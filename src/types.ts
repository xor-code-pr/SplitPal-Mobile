export type GroupMember = {
  user_id: number;
  user_name: string;
  role?: string | null;
  is_admin?: boolean | null;
};

export type Group = {
  id: number;
  name: string;
  description?: string;
  members?: GroupMember[];
  createdById?: number | null;
  createdByName?: string | null;
};

export type Transaction = {
  transaction_id: number;
  title: string;
  amount: string;
  currency?: string | null;
  payer_user_name?: string | null;
  note?: string | null;
  group_name?: string | null;
  created_at?: string | null;
  created_by_user_id?: number | null;
  created_by_user_name?: string | null;
  splits?: TransactionSplitDetail[];
};

export type TransactionSplitDetail = {
  split_id: number;
  user_name?: string | null;
  share_amount: string;
  share_percent?: string | null;
};

export type AdminUserSummary = {
  id: number;
  name: string;
  email: string;
  createdAt: string | null;
};

export type AdminGroupSummary = {
  id: number;
  name: string;
  createdById: number | null;
};
