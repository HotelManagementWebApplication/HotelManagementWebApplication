import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '../components/layout/MainLayout';
import ProtectedRoute from './ProtectedRoute';

// Features
import Login from '../features/auth/pages/Login';
import Profile from '../features/auth/pages/Profile';
import Dashboard from '../features/dashboard/Dashboard';
import CustomerList from '../features/customers/pages/CustomerList';
import CustomerDetail from '../features/customers/pages/CustomerDetail';
import CustomerForm from '../features/customers/pages/CustomerForm';
import RoomList from '../features/rooms/pages/RoomList';
import RoomType from '../features/rooms/pages/RoomType';
import RoomStatus from '../features/rooms/pages/RoomStatus';
import BookingList from '../features/booking/pages/BookingList';
import BookingDetail from '../features/booking/pages/BookingDetail';
import CreateBooking from '../features/booking/pages/CreateBooking';
import CheckIn from '../features/checkin-checkout/pages/CheckIn';
import CheckOut from '../features/checkin-checkout/pages/CheckOut';
import ServiceList from '../features/services/pages/ServiceList';
import ServiceOrder from '../features/services/pages/ServiceOrder';
import Invoice from '../features/payment/pages/Invoice';
import Payment from '../features/payment/pages/Payment';
import RevenueReport from '../features/reports/RevenueReport';
import CustomerHistory from '../features/reports/CustomerHistory';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />

          {/* Customers */}
          <Route path="/customers" element={<CustomerList />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/customers/new" element={<CustomerForm />} />

          {/* Rooms */}
          <Route path="/rooms" element={<RoomList />} />
          <Route path="/rooms/types" element={<RoomType />} />
          <Route path="/rooms/status" element={<RoomStatus />} />

          {/* Booking */}
          <Route path="/booking" element={<BookingList />} />
          <Route path="/booking/:id" element={<BookingDetail />} />
          <Route path="/booking/create" element={<CreateBooking />} />

          {/* Checkin / Checkout */}
          <Route path="/checkin" element={<CheckIn />} />
          <Route path="/checkout" element={<CheckOut />} />

          {/* Services */}
          <Route path="/services" element={<ServiceList />} />
          <Route path="/services/order" element={<ServiceOrder />} />

          {/* Payment */}
          <Route path="/payment" element={<Payment />} />
          <Route path="/payment/invoice/:id" element={<Invoice />} />

          {/* Reports */}
          <Route path="/reports" element={<RevenueReport />} />
          <Route path="/reports/customer-history" element={<CustomerHistory />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export default AppRoutes;
