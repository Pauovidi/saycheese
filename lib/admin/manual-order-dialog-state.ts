import { createManualOrderItem, type ManualOrderFormValues } from "./manual-order"

export const manualOrderDialogContentClass =
  "flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"

export const manualOrderDialogHeaderClass =
  "sticky top-0 z-10 shrink-0 border-b bg-background p-6 pb-4"

export const manualOrderDialogScrollBodyClass =
  "min-h-0 flex-1 overflow-y-auto px-6 py-4"

export const manualOrderDialogFooterClass =
  "sticky bottom-0 z-10 shrink-0 border-t bg-background p-4 sm:p-6"

export function createInitialManualOrderItem(defaultFlavor = "") {
  return createManualOrderItem(defaultFlavor)
}

export function createInitialManualOrderForm(defaultFlavor = ""): ManualOrderFormValues {
  return {
    customerName: "",
    phone: "",
    deliveryDate: "",
    notes: "",
    items: [createInitialManualOrderItem(defaultFlavor)],
  }
}

export function isManualOrderFormDirty(form: ManualOrderFormValues, defaultFlavor = "") {
  const initialItem = createInitialManualOrderItem(defaultFlavor)

  if (form.customerName.trim() || form.phone.trim() || form.deliveryDate.trim() || form.notes.trim()) {
    return true
  }

  if (form.items.length !== 1) {
    return true
  }

  const [item] = form.items
  if (!item) {
    return true
  }

  return item.format !== initialItem.format || item.flavor !== initialItem.flavor || item.quantity !== initialItem.quantity
}

export function shouldConfirmManualOrderCancel(form: ManualOrderFormValues, defaultFlavor = "") {
  return isManualOrderFormDirty(form, defaultFlavor)
}

export function shouldPreventManualOrderOverlayDismiss() {
  return true
}
