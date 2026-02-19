import { Routes, Route } from 'react-router-dom'
import { InvoiceAccessPage } from './InvoiceAccessPage'
import { InvoiceReviewPage } from './InvoiceReviewPage'

export const ClientPortalPage = () => {
  return (
    <Routes>
      <Route index element={<InvoiceAccessPage />} />
      <Route path="invoice/:approvalToken" element={<InvoiceReviewPage />} />
    </Routes>
  )
}
