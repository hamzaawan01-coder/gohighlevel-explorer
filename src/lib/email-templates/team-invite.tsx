import * as React from 'react'
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
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface TeamInviteEmailProps {
  inviteUrl?: string
  agencyName?: string
  inviterName?: string
  role?: string
}

export function TeamInviteEmail({
  inviteUrl = 'https://leadsconvert.co.uk',
  agencyName = 'Lead Convert',
  inviterName = '',
  role = 'member',
}: TeamInviteEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{`You've been invited to join ${agencyName}`}</Preview>
      <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif', margin: 0, padding: '24px' }}>
        <Container style={{ maxWidth: '520px', margin: '0 auto' }}>
          <Heading style={{ fontSize: '22px', color: '#0f172a', marginBottom: '8px' }}>
            You&apos;re invited to {agencyName}
          </Heading>
          <Text style={{ fontSize: '15px', color: '#334155', lineHeight: '24px' }}>
            {inviterName ? `${inviterName} has invited you` : 'You have been invited'} to join{' '}
            {agencyName} as a <strong>{role}</strong>.
          </Text>
          <Section style={{ margin: '28px 0' }}>
            <Button
              href={inviteUrl}
              style={{
                backgroundColor: '#2563eb',
                color: '#ffffff',
                padding: '12px 22px',
                borderRadius: '8px',
                fontSize: '15px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Accept invitation
            </Button>
          </Section>
          <Text style={{ fontSize: '13px', color: '#64748b', lineHeight: '20px' }}>
            Or paste this link into your browser: {inviteUrl}
          </Text>
          <Text style={{ fontSize: '12px', color: '#94a3b8', marginTop: '24px' }}>
            This invitation expires soon. If you weren&apos;t expecting it, you can ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: TeamInviteEmail,
  displayName: 'Team invitation',
  subject: (data: Record<string, any>) =>
    `You're invited to join ${data['agencyName'] ?? 'Lead Convert'}`,
  previewData: {
    inviteUrl: 'https://leadsconvert.co.uk/invite/example-token',
    agencyName: 'Lead Convert',
    inviterName: 'Hamza',
    role: 'member',
  },
} satisfies TemplateEntry
