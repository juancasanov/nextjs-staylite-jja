'use client'

import { Suspense } from "react";
import PaymentCreate from "./PaymentCreate";

const PaymentPage = () => {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <PaymentCreate />
    </Suspense>
  );
};

export default PaymentPage;
