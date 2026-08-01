export interface CommandReceiptTable {
  principal_id: string;
  tool_name: string;
  request_id: string;
  input_json: string;
  result_json: string;
  created_at: number;
}
