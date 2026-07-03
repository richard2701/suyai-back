import React, { useState, useEffect, useCallback } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import {
  Box,
  Button,
  TextInput,
  Typography,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Textarea,
} from '@strapi/design-system';

interface TokenRow {
  id: number;
  documentId: string;
  label: string;
  expiresAt: string;
  active: boolean;
  createdAt: string;
}

interface GenerateResponse {
  id: number;
  documentId: string;
  token: string;
  expiresAt: string;
  label: string;
}

const formatDate = (iso?: string): string =>
  iso
    ? new Date(iso).toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

export default function FeatureFlagsPage() {
  const { get, post, put } = useFetchClient();
  const [label, setLabel] = useState('');
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [copied, setCopied] = useState(false);

  const fetchTokens = useCallback(async () => {
    const { data } = await get(
      '/api/feature-flag-tokens?sort=createdAt:desc&pagination[limit]=5'
    );
    setTokens((data?.data ?? []) as TokenRow[]);
  }, [get]);

  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  const handleGenerate = async () => {
    const { data } = await post('/api/feature-flag-tokens/generate', { label });
    const res = data as GenerateResponse;
    setGeneratedToken(res.token);
    setExpiresAt(res.expiresAt);
    setLabel('');
    fetchTokens();
  };

  const handleToggle = async (documentId: string, currentActive: boolean) => {
    await put(`/api/feature-flag-tokens/${documentId}`, {
      data: { active: !currentActive },
    });
    fetchTokens();
  };

  const handleCopy = () => {
    if (generatedToken) {
      navigator.clipboard.writeText(generatedToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Box padding={8}>
      <Typography variant="alpha">Feature Flags</Typography>

      <Box marginTop={6} marginBottom={4}>
        <TextInput
          label="Token label (optional)"
          placeholder="e.g. Preview new HomeHero — June 2026"
          name="label"
          value={label}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLabel(e.target.value)}
        />
        <Box marginTop={4}>
          <Button onClick={handleGenerate}>Generate Token</Button>
        </Box>
      </Box>

      {generatedToken && (
        <Box marginTop={6} padding={4} background="neutral100" hasRadius>
          <Typography variant="beta">Generated Token</Typography>
          <Box marginTop={1}>
            <Typography variant="pi" textColor="neutral600">
              Expires: {formatDate(expiresAt ?? undefined)}
            </Typography>
          </Box>
          <Box marginTop={3}>
            <Textarea
              label="Token (read-only — copy it now, it won't be shown again)"
              name="generated-token"
              value={generatedToken}
              readOnly
            />
          </Box>
          <Box marginTop={2}>
            <Button variant="secondary" onClick={handleCopy}>
              {copied ? '✓ Copied!' : 'Copy to clipboard'}
            </Button>
          </Box>
          <Box marginTop={2}>
            <Typography variant="pi" textColor="neutral500">
              Activate with: {`<your-site>/?preview=${generatedToken}`}
            </Typography>
          </Box>
        </Box>
      )}

      <Box marginTop={8}>
        <Typography variant="beta">Recent Tokens</Typography>
        <Box marginTop={4}>
          <Table colCount={4} rowCount={tokens.length + 1}>
            <Thead>
              <Tr>
                <Th><Typography variant="sigma">Label</Typography></Th>
                <Th><Typography variant="sigma">Expires At</Typography></Th>
                <Th><Typography variant="sigma">Active</Typography></Th>
                <Th><Typography variant="sigma">Created At</Typography></Th>
              </Tr>
            </Thead>
            <Tbody>
              {tokens.map((t) => (
                <Tr key={t.documentId ?? t.id}>
                  <Td><Typography>{t.label || '—'}</Typography></Td>
                  <Td><Typography>{formatDate(t.expiresAt)}</Typography></Td>
                  <Td>
                    <Button
                      variant={t.active ? 'success-light' : 'danger-light'}
                      size="S"
                      onClick={() => handleToggle(t.documentId, t.active)}
                    >
                      {t.active ? 'Active' : 'Revoked'}
                    </Button>
                  </Td>
                  <Td><Typography>{formatDate(t.createdAt)}</Typography></Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
      </Box>
    </Box>
  );
}
