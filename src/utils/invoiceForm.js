export function hasFourPercentCharge(invoice) {
  return Boolean(invoice.serviceGroups?.some((group) =>
    group.dates?.some((dateGroup) =>
      dateGroup.lines?.some((line) =>
        !line.isSpacer && !line.isNote && line.kind !== "note" && /(?:^|[^\d.])4(?:\.0+)?\s*%/.test(line.description || ""),
      ),
    ),
  ));
}

export function withoutPaymentDetails(invoice) {
  return { ...invoice, paymentProfile: "", notesTitle: "", paymentNotes: "", footerText: "" };
}

export function nextDocumentNumber(value) {
  const current = String(value || "").trim();
  const match = current.match(/^(.*?)(\d+)(\D*)$/);
  if (!match) return current ? `${current}1` : "1";
  return `${match[1]}${String(Number(match[2]) + 1).padStart(match[2].length, "0")}${match[3]}`;
}
