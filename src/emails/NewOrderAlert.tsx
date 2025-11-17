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

interface NewOrderAlertEmailProps {
  orderNumber: string;
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  pickupAddress: string;
  pickupDate: string;
  pickupTimeWindow: string;
  serviceType: string;
  notes?: string;
  estimatedTotal: number;
  orderUrl?: string;
}

export const NewOrderAlertEmail = ({
  orderNumber = '12345678',
  orderId = 'abc-123-def-456',
  customerName = 'John Doe',
  customerEmail = 'john@example.com',
  customerPhone = '+1 (555) 123-4567',
  pickupAddress = '123 Main St, Detroit, MI 48201',
  pickupDate = 'Monday, November 18, 2025',
  pickupTimeWindow = '2:00 PM - 4:00 PM',
  serviceType = 'Wash & Fold',
  notes = 'Please use unscented detergent',
  estimatedTotal = 35.00,
  orderUrl = 'https://bagsoflaundry.com/dashboard/orders/123'
}: NewOrderAlertEmailProps) => {
  const previewText = `New order from ${customerName} - Pickup ${pickupDate}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Heading style={h1}>🧺 New Order Received!</Heading>

          <Section style={alertBox}>
            <Text style={alertText}>
              <strong>Order #{orderNumber}</strong>
              <br />
              Pickup: {pickupDate} at {pickupTimeWindow}
            </Text>
          </Section>

          {/* Customer Details */}
          <Section style={section}>
            <Heading style={h2}>👤 Customer Information</Heading>
            <table style={detailsTable}>
              <tr>
                <td style={labelCell}>Name:</td>
                <td style={valueCell}><strong>{customerName}</strong></td>
              </tr>
              <tr>
                <td style={labelCell}>Email:</td>
                <td style={valueCell}>
                  <a href={`mailto:${customerEmail}`} style={link}>
                    {customerEmail}
                  </a>
                </td>
              </tr>
              {customerPhone && (
                <tr>
                  <td style={labelCell}>Phone:</td>
                  <td style={valueCell}>
                    <a href={`tel:${customerPhone.replace(/\D/g, '')}`} style={link}>
                      {customerPhone}
                    </a>
                  </td>
                </tr>
              )}
            </table>
          </Section>

          <Hr style={hr} />

          {/* Pickup Details */}
          <Section style={section}>
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
                <td style={valueCell}>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pickupAddress)}`}
                    style={link}
                    target="_blank"
                  >
                    {pickupAddress}
                  </a>
                </td>
              </tr>
            </table>
          </Section>

          <Hr style={hr} />

          {/* Service Details */}
          <Section style={section}>
            <Heading style={h2}>🧼 Service Details</Heading>
            <table style={detailsTable}>
              <tr>
                <td style={labelCell}>Service:</td>
                <td style={valueCell}>{serviceType}</td>
              </tr>
              <tr>
                <td style={labelCell}>Estimated:</td>
                <td style={valueCell}><strong>${estimatedTotal.toFixed(2)}</strong></td>
              </tr>
            </table>

            {notes && (
              <>
                <Text style={notesLabel}>Special Instructions:</Text>
                <Section style={notesBox}>
                  <Text style={notesText}>{notes}</Text>
                </Section>
              </>
            )}
          </Section>

          {/* Action Buttons */}
          {orderUrl && (
            <Section style={buttonSection}>
              <Button style={button} href={orderUrl}>
                View Order Details
              </Button>
            </Section>
          )}

          <Hr style={hr} />

          {/* Quick Actions */}
          <Section style={quickActionsSection}>
            <Heading style={h3}>Quick Actions</Heading>
            <Text style={smallText}>
              • <a href={`mailto:${customerEmail}?subject=Re: Order ${orderNumber}`} style={link}>
                Email Customer
              </a>
              <br />
              {customerPhone && (
                <>
                  • <a href={`sms:${customerPhone.replace(/\D/g, '')}`} style={link}>
                    Text Customer
                  </a>
                  <br />
                </>
              )}
              • <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(pickupAddress)}`}
                style={link}
                target="_blank"
              >
                Get Directions
              </a>
            </Text>
          </Section>

          <Hr style={hr} />

          {/* Footer */}
          <Text style={footer}>
            Order ID: {orderId}
            <br />
            This is an automated notification from Bags of Laundry
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default NewOrderAlertEmail;

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
  fontSize: '28px',
  fontWeight: 'bold',
  textAlign: 'center' as const,
  margin: '40px 0 20px',
  padding: '0 40px',
};

const h2 = {
  color: '#1f2937',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 12px 0',
};

const h3 = {
  color: '#1f2937',
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '0 0 8px 0',
};

const alertBox = {
  backgroundColor: '#3b82f6',
  borderRadius: '8px',
  padding: '20px',
  margin: '20px 40px',
  textAlign: 'center' as const,
};

const alertText = {
  color: '#ffffff',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0',
};

const section = {
  padding: '0 40px',
  margin: '20px 0',
};

const detailsTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  margin: '0',
};

const labelCell = {
  color: '#6b7280',
  fontSize: '14px',
  padding: '6px 12px 6px 0',
  width: '100px',
  verticalAlign: 'top' as const,
};

const valueCell = {
  color: '#1f2937',
  fontSize: '14px',
  padding: '6px 0',
};

const notesLabel = {
  color: '#6b7280',
  fontSize: '14px',
  fontWeight: '500',
  margin: '16px 0 8px 0',
};

const notesBox = {
  backgroundColor: '#fef3c7',
  borderLeft: '4px solid #f59e0b',
  borderRadius: '4px',
  padding: '12px 16px',
  margin: '8px 0',
};

const notesText = {
  color: '#92400e',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
  whiteSpace: 'pre-wrap' as const,
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '24px 40px',
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

const quickActionsSection = {
  backgroundColor: '#f3f4f6',
  borderRadius: '8px',
  padding: '16px',
  margin: '20px 40px',
};

const smallText = {
  color: '#4b5563',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '4px 0',
};

const footer = {
  color: '#9ca3af',
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
