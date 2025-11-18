import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from '@react-email/components';
import * as React from 'react';

interface OrderConfirmationEmailProps {
  orderNumber: string;
  customerName: string;
  pickupAddress: string;
  pickupDate: string;
  pickupTimeWindow: string;
  serviceType: string;
  estimatedTotal: number;
  trackingUrl: string;
}

export const OrderConfirmationEmail = ({
  orderNumber = '12345678',
  customerName = 'John Doe',
  pickupAddress = '123 Main St, Detroit, MI 48201',
  pickupDate = 'Monday, November 18, 2025',
  pickupTimeWindow = '2:00 PM - 4:00 PM',
  serviceType = 'Wash & Fold',
  estimatedTotal = 35.00,
  trackingUrl = 'https://bagsoflaundry.com/orders/123'
}: OrderConfirmationEmailProps) => {
  const previewText = `Order #${orderNumber} confirmed - Pickup ${pickupDate}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Heading style={h1}>🧺 Order Confirmed!</Heading>

          <Text style={text}>
            Hi {customerName},
          </Text>

          <Text style={text}>
            Thank you for choosing Bags of Laundry! Your order has been confirmed and we're excited to take care of your laundry.
          </Text>

          {/* Order Number */}
          <Section style={orderNumberSection}>
            <Text style={orderNumberLabel}>Order Number</Text>
            <Text style={orderNumberValue}>#{orderNumber}</Text>
          </Section>

          {/* Pickup Details */}
          <Section style={detailsSection}>
            <Heading style={h2}>📍 Pickup Details</Heading>

            <table style={detailsTable}>
              <tr>
                <td style={labelCell}>Date:</td>
                <td style={valueCell}>{pickupDate}</td>
              </tr>
              <tr>
                <td style={labelCell}>Time:</td>
                <td style={valueCell}>{pickupTimeWindow}</td>
              </tr>
              <tr>
                <td style={labelCell}>Address:</td>
                <td style={valueCell}>{pickupAddress}</td>
              </tr>
              <tr>
                <td style={labelCell}>Service:</td>
                <td style={valueCell}>{serviceType}</td>
              </tr>
            </table>
          </Section>

          {/* Pricing */}
          <Section style={pricingSection}>
            <Heading style={h2}>💰 Pricing</Heading>
            <Text style={text}>
              <strong>Estimated Total: ${estimatedTotal.toFixed(2)}</strong>
            </Text>
            <Text style={smallText}>
              *Final amount may vary based on actual weight measured at pickup
            </Text>
          </Section>

          <Hr style={hr} />

          {/* Track Order Button */}
          <Section style={buttonSection}>
            <Button style={button} href={trackingUrl}>
              Track Your Order
            </Button>
          </Section>

          {/* What to Expect */}
          <Section style={infoSection}>
            <Heading style={h3}>What to Expect</Heading>
            <Text style={smallText}>
              ✓ We'll text you 15 minutes before pickup
              <br />
              ✓ Our driver will weigh your items and adjust the final charge
              <br />
              ✓ Your laundry will be cleaned and returned within 24-48 hours
              <br />
              ✓ We'll notify you when we're on the way for delivery
            </Text>
          </Section>

          <Hr style={hr} />

          {/* Contact Info */}
          <Text style={footer}>
            Questions? Reply to this email or call us at{' '}
            <a href="tel:+18559274224" style={link}>
              (855) 927-4224
            </a>
          </Text>

          <Text style={footer}>
            Bags of Laundry - Detroit's Premier Laundry Service
            <br />
            <a href="https://bagsoflaundry.com" style={link}>
              bagsoflaundry.com
            </a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default OrderConfirmationEmail;

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
};

const h1 = {
  color: '#1f2937',
  fontSize: '32px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '40px 0 20px',
  padding: '0 40px',
};

const h2 = {
  color: '#1f2937',
  fontSize: '20px',
  fontWeight: 'bold',
  margin: '20px 0 10px',
};

const h3 = {
  color: '#1f2937',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '16px 0 8px',
};

const text = {
  color: '#4b5563',
  fontSize: '16px',
  lineHeight: '24px',
  padding: '0 40px',
};

const smallText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '4px 0',
};

const orderNumberSection = {
  backgroundColor: '#3b82f6',
  borderRadius: '8px',
  padding: '20px',
  margin: '20px 40px',
  textAlign: 'center' as const,
};

const orderNumberLabel = {
  color: '#dbeafe',
  fontSize: '12px',
  fontWeight: '500',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 8px 0',
};

const orderNumberValue = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '0',
};

const detailsSection = {
  padding: '0 40px',
  margin: '20px 0',
};

const detailsTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
};

const labelCell = {
  color: '#6b7280',
  fontSize: '14px',
  padding: '8px 0',
  width: '80px',
  verticalAlign: 'top' as const,
};

const valueCell = {
  color: '#1f2937',
  fontSize: '14px',
  padding: '8px 0',
  fontWeight: '500',
};

const pricingSection = {
  backgroundColor: '#f3f4f6',
  borderRadius: '8px',
  padding: '20px',
  margin: '20px 40px',
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '20px 40px',
};

const buttonSection = {
  padding: '20px 40px',
  textAlign: 'center' as const,
};

const button = {
  backgroundColor: '#3b82f6',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 32px',
};

const infoSection = {
  backgroundColor: '#eff6ff',
  borderRadius: '8px',
  padding: '20px',
  margin: '20px 40px',
};

const footer = {
  color: '#6b7280',
  fontSize: '12px',
  lineHeight: '16px',
  textAlign: 'center' as const,
  padding: '0 40px',
  margin: '12px 0',
};

const link = {
  color: '#3b82f6',
  textDecoration: 'underline',
};
