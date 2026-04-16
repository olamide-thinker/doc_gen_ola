// Shared types - to be populated as we extract types from the accounting app
// This will eventually include:
// - Task
// - Receipt
// - Invoice
// - BOQ
// - ResourceCategory
// - TransactionLog
// etc.

export interface Task {
  id: string;
  title: string;
  priority?: string;
  dueDate?: string;
  budget?: number;
  // To be expanded
}

export interface Receipt {
  id: string;
  taskId: string;
  amount: number;
  // To be expanded
}

export interface Invoice {
  id: string;
  // To be expanded
}
