import { useState, useRef } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Upload, Download, AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface BatchResult {
  inputName: string;
  status: 'MATCH' | 'POSSIBLE_MATCH' | 'NO_MATCH';
  matchScore: number;
  matchedRecord?: {
    id: string;
    name: string;
    nameArabic?: string | null;
    matchType: string;
  };
  error?: string;
}

interface BatchStats {
  total: number;
  matches: number;
  possibleMatches: number;
  noMatches: number;
  errors: number;
  matchRate: number;
  possibleMatchRate: number;
  averageScore: number;
}

function BatchPage() {
  const { data: user } = trpc.auth.me.useQuery();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BatchResult[]>([]);
  const [stats, setStats] = useState<BatchStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const batchMutation = trpc.batch.process.useMutation({
    onSuccess: (data) => {
      setResults(data.results as BatchResult[]);
      setStats(data.stats as BatchStats);
      setLoading(false);
    },
    onError: (err) => {
      setError(err.message || 'An error occurred during batch processing');
      setLoading(false);
    },
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Please log in to use batch screening</AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      setError(null);
      setResults([]);
      setStats(null);
      setFileName(file.name);

      // Read Excel file
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { header: 1 });

      // Extract names - skip header row, get first column
      const names: string[] = [];
      for (let i = 1; i < data.length; i++) {
        const row = data[i] as any[];
        if (row && row[0]) {
          const name = String(row[0]).trim();
          if (name.length > 0) {
            names.push(name);
          }
        }
      }

      if (names.length === 0) {
        setError('No valid names found in the file. Make sure the first column contains names.');
        setLoading(false);
        return;
      }

      if (names.length > 100) {
        setError(`File contains ${names.length} names. Maximum allowed is 100.`);
        setLoading(false);
        return;
      }

      // Send to server via tRPC
      batchMutation.mutate({ names });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read the file. Please make sure it is a valid Excel file.');
      setLoading(false);
    }

    // Reset file input so same file can be uploaded again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExport = () => {
    if (results.length === 0) return;

    const exportData = results.map((r) => ({
      'Input Name': r.inputName,
      'Status': r.status,
      'Match Score': `${r.matchScore}%`,
      'Matched Name': r.matchedRecord?.name || '',
      'Matched Name (Arabic)': r.matchedRecord?.nameArabic || '',
      'Match Type': r.matchedRecord?.matchType || '',
      'Error': r.error || '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Results');
    XLSX.writeFile(workbook, `batch-results-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Batch Screening</h1>
          <p className="text-muted-foreground">Upload an Excel file with up to 100 names for batch processing</p>
        </div>

        {/* Upload Section */}
        <Card className="p-8 mb-8">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:bg-accent/50 transition"
            onClick={() => !loading && fileInputRef.current?.click()}
          >
            <Upload className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-semibold text-foreground mb-2">Upload Excel File</p>
            <p className="text-sm text-muted-foreground mb-4">
              {fileName ? `Selected: ${fileName}` : 'Click to select or drag and drop (.xlsx, .xls, .csv)'}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              disabled={loading}
              className="hidden"
            />
            <Button disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Select File'
              )}
            </Button>
          </div>
        </Card>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-8">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="p-4">
              <div className="text-sm text-muted-foreground mb-1">Total Items</div>
              <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            </Card>
            <Card className="p-4 border-green-200 bg-green-50">
              <div className="text-sm text-green-700 mb-1">Matches</div>
              <div className="text-2xl font-bold text-green-700">{stats.matches}</div>
              <div className="text-xs text-green-600 mt-1">{stats.matchRate}%</div>
            </Card>
            <Card className="p-4 border-yellow-200 bg-yellow-50">
              <div className="text-sm text-yellow-700 mb-1">Possible Matches</div>
              <div className="text-2xl font-bold text-yellow-700">{stats.possibleMatches}</div>
              <div className="text-xs text-yellow-600 mt-1">{stats.possibleMatchRate}%</div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-muted-foreground mb-1">Average Score</div>
              <div className="text-2xl font-bold text-foreground">{stats.averageScore}%</div>
            </Card>
          </div>
        )}

        {/* Results Table */}
        {results.length > 0 && (
          <>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-foreground">Results ({results.length})</h2>
              <Button onClick={handleExport} variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Export Results
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted">
                    <th className="px-4 py-3 text-left font-semibold text-foreground">#</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Input Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Score</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Matched Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-foreground">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr key={index} className="border-b border-border hover:bg-muted/50">
                      <td className="px-4 py-3 text-muted-foreground">{index + 1}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{result.inputName}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {result.status === 'MATCH' && (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                              <span className="text-green-600 font-semibold">Match</span>
                            </>
                          )}
                          {result.status === 'POSSIBLE_MATCH' && (
                            <>
                              <AlertTriangle className="h-4 w-4 text-yellow-600" />
                              <span className="text-yellow-600 font-semibold">Possible</span>
                            </>
                          )}
                          {result.status === 'NO_MATCH' && (
                            <span className="text-muted-foreground">No Match</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">{result.matchScore}%</td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="text-foreground">{result.matchedRecord?.name}</div>
                          {result.matchedRecord?.nameArabic && (
                            <div className="text-sm text-muted-foreground">{result.matchedRecord.nameArabic}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{result.matchedRecord?.matchType}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default BatchPage;
